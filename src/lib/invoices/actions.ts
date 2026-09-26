'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CatalogItemType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth/session';
import { documentTotals, type MoneyLineInput } from '@/lib/money';

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

const UpdateInvoiceFormSchema = InvoiceFormSchema.and(z.object({ id: z.string().uuid() }));

export async function updateInvoiceAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = UpdateInvoiceFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const { data: lines, error: linesError } = parseLines(d.linesJson);
  if (linesError) return { error: linesError };

  const db = tenantDb(tenant.id);
  const existing = await db.invoice.findUnique({ where: { id: d.id } });
  if (!existing) return { error: 'Invoice not found.' };
  if (existing.status !== 'DRAFT') {
    return { error: 'This invoice has been issued and is locked. Correct it with a credit note.' };
  }

  if (d.propertyId) {
    const property = await prisma.property.findFirst({ where: { id: d.propertyId, tenantId: tenant.id, clientId: existing.clientId } });
    if (!property) return { error: 'Property not found for this client.' };
  }

  const { rows, totals } = buildLinesAndTotals(lines!, tenant);

  await prisma.$transaction([
    prisma.lineItem.deleteMany({ where: { invoiceId: d.id } }),
    prisma.invoice.update({
      where: { id: d.id },
      data: {
        propertyId: d.propertyId || null,
        notes: d.notes || null,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        lines: { create: rows },
      },
    }),
  ]);

  revalidatePath('/invoices');
  revalidatePath(`/invoices/${d.id}`);
  return { ok: 'Saved.' };
}

/** "Create invoice" on a job: copies the job's client, property and lines into a fresh draft. */
export async function createInvoiceFromJobAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const jobId = String(formData.get('jobId') ?? '');

  const db = tenantDb(tenant.id);
  const job = await db.job.findUnique({ where: { id: jobId }, include: { lines: { orderBy: { sortOrder: 'asc' } } } });
  if (!job) return;

  const totals = documentTotals(
    job.lines.map((l) => ({ quantity: Number(l.quantity), unitPriceCents: l.unitPriceCents, unitCostCents: l.unitCostCents, taxRateBp: l.taxRateBp }))
  );

  const invoice = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      clientId: job.clientId,
      propertyId: job.propertyId,
      jobId: job.id,
      currencyCode: tenant.currencyCode,
      notes: tenant.invoiceTerms || undefined,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      lines: {
        create: job.lines.map((l, i) => ({
          catalogItemId: l.catalogItemId ?? undefined,
          type: l.type,
          description: l.description,
          quantity: l.quantity,
          unitCostCents: l.unitCostCents,
          unitPriceCents: l.unitPriceCents,
          taxRateBp: l.taxRateBp,
          sortOrder: i,
        })),
      },
    },
  });

  revalidatePath('/invoices');
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/invoices/${invoice.id}`);
}

export async function deleteInvoiceAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const id = String(formData.get('id') ?? '');

  const db = tenantDb(tenant.id);
  const existing = await db.invoice.findUnique({ where: { id } });
  if (!existing || existing.status !== 'DRAFT') return;

  await db.invoice.delete({ where: { id } });
  revalidatePath('/invoices');
}
