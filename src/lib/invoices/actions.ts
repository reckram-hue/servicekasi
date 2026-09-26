'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CatalogItemType, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth/session';
import { documentTotals, formatMoney, parseMoneyInput, type MoneyLineInput } from '@/lib/money';
import { addDaysToDateStr, todayDateStr } from '@/lib/dates';
import { issueInvoice } from '@/lib/invoices/issue';
import { invoiceBalanceCents, recordMoneyEntry, reversePayment } from '@/lib/invoices/payments';
import { issueCreditNote } from '@/lib/invoices/creditNotes';
import { depositDeductionRows, depositLines, finalInvoiceIssuedOn } from '@/lib/invoices/deposits';
import { MANUAL_PAYMENT_METHODS } from '@/lib/invoices/paymentMethods';

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; ok?: string } | undefined;

const LineInputSchema = z.object({
  catalogItemId: z.string().uuid().optional().nullable(),
  type: z.enum(CatalogItemType),
  description: z.string().trim().min(1),
  quantity: z.number().positive().max(100000),
  unitCostCents: z.number().int().min(0),
  unitPriceCents: z.number().int().min(0),
  taxable: z.boolean(),
});

const InvoiceFormSchema = z.object({
  clientId: z.string().uuid({ error: 'Choose a client.' }),
  propertyId: z.union([z.string().uuid(), z.literal('')]).optional(),
  notes: z.string().trim().optional(),
  linesJson: z.string(),
});

/** Turns validated line inputs + the tenant's tax settings into DB-ready rows and fresh totals. */
function buildLinesAndTotals(lines: z.infer<typeof LineInputSchema>[], tenant: { vatRegistered: boolean; defaultTaxRateBp: number }) {
  const moneyLines: (MoneyLineInput & { line: z.infer<typeof LineInputSchema> })[] = lines.map((line) => ({
    line,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    unitCostCents: line.unitCostCents,
    // The tax rate is never taken from the client — only whether VAT applies to this line.
    taxRateBp: tenant.vatRegistered && line.taxable ? tenant.defaultTaxRateBp : 0,
  }));

  const totals = documentTotals(moneyLines);

  const rows = moneyLines.map((m, i) => ({
    catalogItemId: m.line.catalogItemId || undefined,
    type: m.line.type,
    description: m.line.description,
    quantity: m.line.quantity,
    unitCostCents: m.line.unitCostCents,
    unitPriceCents: m.line.unitPriceCents,
    taxRateBp: m.taxRateBp,
    sortOrder: i,
  }));

  return { rows, totals };
}

function parseLines(linesJson: string): { data?: z.infer<typeof LineInputSchema>[]; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(linesJson);
  } catch {
    return { error: 'Something went wrong reading the invoice lines. Please try again.' };
  }
  const parsed = z.array(LineInputSchema).min(1, { error: 'Add at least one line.' }).safeParse(raw);
  if (!parsed.success) return { error: 'One or more lines are invalid. Check quantities and prices.' };
  return { data: parsed.data };
}

type LineRow = Omit<Prisma.LineItemCreateWithoutInvoiceInput, 'quantity'> & { quantity: number | Prisma.Decimal };

/** Work lines followed by any "Less: deposit" lines, numbered in order, with totals over all of them. */
function withDeductions(rows: LineRow[], deductions: Prisma.LineItemCreateWithoutInvoiceInput[]) {
  const all = [...rows, ...deductions].map((r, i) => ({ ...r, sortOrder: i }));
  const totals = documentTotals(all.map((r) => ({ quantity: Number(r.quantity), unitPriceCents: r.unitPriceCents, taxRateBp: r.taxRateBp ?? 0 })));
  return { lines: all, totals };
}

/** A new walk-in / counter-sale invoice with no job behind it. */
export async function createInvoiceAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = InvoiceFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const { data: lines, error: linesError } = parseLines(d.linesJson);
  if (linesError) return { error: linesError };

  const client = await prisma.client.findFirst({ where: { id: d.clientId, tenantId: tenant.id } });
  if (!client) return { error: 'Client not found.' };
  if (d.propertyId) {
    const property = await prisma.property.findFirst({ where: { id: d.propertyId, tenantId: tenant.id, clientId: d.clientId } });
    if (!property) return { error: 'Property not found for this client.' };
  }

  const { rows, totals } = buildLinesAndTotals(lines!, tenant);

  // Drafts get no number — numbers are only allocated when an invoice is
  // issued, so a deleted draft never leaves a gap in the sequence.
  const invoice = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      clientId: d.clientId,
      propertyId: d.propertyId || undefined,
      currencyCode: tenant.currencyCode,
      notes: d.notes || undefined,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      lines: { create: rows },
    },
  });

  revalidatePath('/invoices');
  redirect(`/invoices/${invoice.id}`);
}

const UpdateInvoiceFormSchema = InvoiceFormSchema.and(
  z.object({
    id: z.string().uuid(),
    intent: z.enum(['save', 'issue']).default('save'),
    dueDate: z.union([z.iso.date(), z.literal('')]).optional(),
  })
);

const LOCKED_ERROR = 'This invoice has been issued and is locked. Correct it with a credit note.';

/** Saves a draft; with intent "issue", then issues exactly what was just saved. */
export async function updateInvoiceAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant, user } = await requireRole();
  const parsed = UpdateInvoiceFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const { data: lines, error: linesError } = parseLines(d.linesJson);
  if (linesError) return { error: linesError };

  if (d.intent === 'issue') {
    const today = todayDateStr(tenant.timezone);
    if (!d.dueDate || d.dueDate < today || d.dueDate > addDaysToDateStr(today, 365)) {
      return { fieldErrors: { dueDate: ['Choose a due date between today and a year from now.'] } };
    }
  }

  const db = tenantDb(tenant.id);
  const existing = await db.invoice.findUnique({ where: { id: d.id } });
  if (!existing) return { error: 'Invoice not found.' };
  if (existing.status !== 'DRAFT') return { error: LOCKED_ERROR };

  if (d.propertyId) {
    const property = await prisma.property.findFirst({ where: { id: d.propertyId, tenantId: tenant.id, clientId: existing.clientId } });
    if (!property) return { error: 'Property not found for this client.' };
  }

  const { rows } = buildLinesAndTotals(lines!, tenant);

  // Lock the row and re-check it's still a draft, so an issue happening at
  // the same moment can't be followed by this save rewriting its lines.
  const saved = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Invoice"
      WHERE "id" = ${d.id} AND "tenantId" = ${tenant.id} AND "status" = 'DRAFT'
      FOR UPDATE`;
    if (locked.length === 0) return false;
    // The deposit deducted is never taken from the form: it's worked out afresh on every save.
    const deductions =
      existing.jobId && !existing.isDeposit
        ? await depositDeductionRows(tx, { tenantId: tenant.id, jobId: existing.jobId, forInvoiceId: d.id, lock: false })
        : [];
    const all = withDeductions(rows, deductions);
    await tx.lineItem.deleteMany({ where: { invoiceId: d.id } });
    await tx.invoice.update({
      where: { id: d.id },
      data: {
        propertyId: d.propertyId || null,
        notes: d.notes || null,
        subtotalCents: all.totals.subtotalCents,
        taxCents: all.totals.taxCents,
        totalCents: all.totals.totalCents,
        lines: { create: all.lines },
      },
    });
    return true;
  });
  if (!saved) return { error: LOCKED_ERROR };

  revalidatePath('/invoices');
  revalidatePath(`/invoices/${d.id}`);
  if (d.intent !== 'issue') return { ok: 'Saved.' };

  const result = await prisma.$transaction((tx) =>
    issueInvoice(tx, { tenantId: tenant.id, invoiceId: d.id, dueDate: d.dueDate!, userId: user.id })
  );
  if ('error' in result) return { error: `Your changes are saved, but the invoice wasn't issued: ${result.error}` };

  if (existing.jobId) revalidatePath(`/jobs/${existing.jobId}`);
  redirect(`/invoices/${d.id}`);
}

/** "Create invoice" on a job: copies the job's client, property and lines into a fresh draft. */
export async function createInvoiceFromJobAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const jobId = String(formData.get('jobId') ?? '');

  const db = tenantDb(tenant.id);
  const job = await db.job.findUnique({ where: { id: jobId }, include: { lines: { orderBy: { sortOrder: 'asc' } } } });
  if (!job) return;

  const invoice = await prisma.$transaction(async (tx) => {
    const deductions = await depositDeductionRows(tx, { tenantId: tenant.id, jobId: job.id, forInvoiceId: null, lock: false });
    const all = withDeductions(
      job.lines.map((l) => ({
        catalogItemId: l.catalogItemId ?? undefined,
        type: l.type,
        description: l.description,
        quantity: l.quantity,
        unitCostCents: l.unitCostCents,
        unitPriceCents: l.unitPriceCents,
        taxRateBp: l.taxRateBp,
      })),
      deductions
    );
    return tx.invoice.create({
      data: {
        tenantId: tenant.id,
        clientId: job.clientId,
        propertyId: job.propertyId,
        jobId: job.id,
        currencyCode: tenant.currencyCode,
        notes: tenant.invoiceTerms || undefined,
        subtotalCents: all.totals.subtotalCents,
        taxCents: all.totals.taxCents,
        totalCents: all.totals.totalCents,
        lines: { create: all.lines },
      },
    });
  });

  revalidatePath('/invoices');
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/invoices/${invoice.id}`);
}

/**
 * "Invoice the deposit" on an approved quote (or its job): a draft tax
 * invoice for the quote's deposit, issued like any other invoice. VAT is due
 * when a deposit is received, so it gets its own invoice; the job's final
 * invoice then deducts it. One deposit invoice per quote.
 */
export async function createDepositInvoiceAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const quoteId = String(formData.get('quoteId') ?? '');

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Quote" WHERE "id" = ${quoteId} AND "tenantId" = ${tenant.id} FOR UPDATE`;
    if (locked.length === 0) return null;
    const quote = await tx.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { lines: true, jobs: { select: { id: true } } } });
    if (quote.status !== 'APPROVED' && quote.status !== 'CONVERTED') return null;

    const existing = await tx.invoice.findFirst({ where: { tenantId: tenant.id, quoteId, isDeposit: true, status: { not: 'VOID' } } });
    if (existing) return existing;

    // Once the job has been invoiced in full, a deposit would bill the client twice.
    if (quote.jobs[0] && (await finalInvoiceIssuedOn(tx, quote.jobs[0].id))) return null;

    const lines = depositLines(quote);
    if (lines.length === 0) return null;
    const totals = documentTotals(lines.map((l) => ({ quantity: 1, unitPriceCents: l.unitPriceCents, taxRateBp: l.taxRateBp ?? 0 })));
    return tx.invoice.create({
      data: {
        tenantId: tenant.id,
        clientId: quote.clientId,
        propertyId: quote.propertyId,
        quoteId,
        jobId: quote.jobs[0]?.id,
        isDeposit: true,
        currencyCode: tenant.currencyCode,
        notes: tenant.invoiceTerms || undefined,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        lines: { create: lines },
      },
    });
  });
  if (!result) return;

  revalidatePath('/invoices');
  revalidatePath(`/quotes/${quoteId}`);
  if (result.jobId) revalidatePath(`/jobs/${result.jobId}`);
  redirect(`/invoices/${result.id}`);
}

export async function deleteInvoiceAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const id = String(formData.get('id') ?? '');

  // One conditional statement, so an invoice issued a moment ago is never deleted.
  await tenantDb(tenant.id).invoice.deleteMany({ where: { id, status: 'DRAFT' } });
  revalidatePath('/invoices');
}

const RecordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  kind: z.enum(['payment', 'refund']).default('payment'),
  amount: z.string().trim().min(1, { error: 'Enter an amount.' }),
  date: z.iso.date({ error: 'Choose a date.' }),
  method: z.enum(MANUAL_PAYMENT_METHODS, { error: 'Choose how it was paid.' }),
  reference: z.string().trim().max(200).optional(),
});

/** Records a payment the owner took by hand (cash, EFT, card machine), or a refund paid back to the client. */
export async function recordPaymentAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant, user } = await requireRole();
  const parsed = RecordPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const amountCents = parseMoneyInput(d.amount);
  if (amountCents === null || amountCents <= 0) {
    return { fieldErrors: { amount: ['Enter a valid amount more than zero.'] } };
  }

  const today = todayDateStr(tenant.timezone);
  if (d.date > today) return { fieldErrors: { date: ["The date can't be in the future."] } };

  const invoice = await tenantDb(tenant.id).invoice.findUnique({
    where: { id: d.invoiceId },
    select: { kind: true, status: true, totalCents: true, creditedCents: true, paidCents: true, currencyCode: true, jobId: true },
  });
  if (!invoice || invoice.kind === 'CREDIT_NOTE') return { error: 'Invoice not found.' };
  const balanceCents = invoiceBalanceCents(invoice);
  const limitCents = d.kind === 'payment' ? balanceCents : -balanceCents;
  if (invoice.status === 'DRAFT' || invoice.status === 'VOID' || limitCents <= 0) {
    return { error: d.kind === 'payment' ? 'Nothing is owed on this invoice.' : 'No refund is due on this invoice.' };
  }
  if (amountCents > limitCents) {
    const what = d.kind === 'payment' ? 'the balance due' : 'the refund due';
    return { fieldErrors: { amount: [`Can't be more than ${what}, ${formatMoney(limitCents, invoice.currencyCode)}.`] } };
  }

  const result = await prisma.$transaction((tx) =>
    recordMoneyEntry(tx, d.kind, {
      tenantId: tenant.id,
      invoiceId: d.invoiceId,
      amountCents,
      method: d.method,
      // "YYYY-MM-DD" → UTC midnight, like Invoice.dueAt.
      receivedAt: new Date(`${d.date}T00:00:00Z`),
      reference: d.reference || null,
      userId: user.id,
    })
  );
  if ('error' in result) return { error: result.error };

  revalidatePath(`/invoices/${d.invoiceId}`);
  revalidatePath('/invoices');
  if (invoice.jobId) revalidatePath(`/jobs/${invoice.jobId}`);
  return { ok: d.kind === 'payment' ? 'Payment recorded.' : 'Refund recorded.' };
}

const ReversePaymentSchema = z.object({ paymentId: z.string().uuid(), invoiceId: z.string().uuid() });

/** Corrects a wrongly recorded payment. The row stays, only marked reversed, so there's always a trail. */
export async function reversePaymentAction(formData: FormData): Promise<void> {
  const { tenant, user } = await requireRole();
  const parsed = ReversePaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const d = parsed.data;

  const invoice = await tenantDb(tenant.id).invoice.findUnique({ where: { id: d.invoiceId }, select: { jobId: true } });

  await prisma.$transaction((tx) => reversePayment(tx, { tenantId: tenant.id, paymentId: d.paymentId, userId: user.id }));

  revalidatePath(`/invoices/${d.invoiceId}`);
  revalidatePath('/invoices');
  if (invoice?.jobId) revalidatePath(`/jobs/${invoice.jobId}`);
}

const CreditNoteSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().trim().min(3, { error: 'Say briefly why you are crediting the client.' }).max(1000),
  creditsJson: z.string(),
});

const CreditsSchema = z.array(z.object({ lineItemId: z.string().uuid(), amount: z.string() }));

/** Issues a credit note against an issued invoice, then shows it. */
export async function createCreditNoteAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant, user } = await requireRole();
  const parsed = CreditNoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  let raw: unknown;
  try {
    raw = JSON.parse(d.creditsJson);
  } catch {
    return { error: 'Something went wrong reading the amounts. Please try again.' };
  }
  const creditsParsed = CreditsSchema.safeParse(raw);
  if (!creditsParsed.success) return { error: 'Something went wrong reading the amounts. Please try again.' };

  const credits: { lineItemId: string; amountCents: number }[] = [];
  for (const c of creditsParsed.data) {
    if (c.amount.trim() === '') continue;
    const amountCents = parseMoneyInput(c.amount);
    if (amountCents === null || amountCents < 0) return { error: 'Check the amounts — each must be a number, zero or more.' };
    credits.push({ lineItemId: c.lineItemId, amountCents });
  }

  const invoice = await tenantDb(tenant.id).invoice.findUnique({ where: { id: d.invoiceId }, select: { jobId: true } });
  if (!invoice) return { error: 'Invoice not found.' };

  const result = await prisma.$transaction((tx) =>
    issueCreditNote(tx, { tenantId: tenant.id, invoiceId: d.invoiceId, reason: d.reason, credits, userId: user.id })
  );
  if ('error' in result) return { error: result.error };

  revalidatePath('/invoices');
  revalidatePath(`/invoices/${d.invoiceId}`);
  if (invoice.jobId) revalidatePath(`/jobs/${invoice.jobId}`);
  redirect(`/invoices/${result.id}`);
}
