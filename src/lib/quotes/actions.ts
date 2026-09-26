'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CatalogItemType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { tenantDb, nextDocumentNumber } from '@/lib/db';
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
  optional: z.boolean(),
});

const QuoteFormSchema = z.object({
  clientId: z.string().uuid({ error: 'Choose a client.' }),
  propertyId: z.union([z.string().uuid(), z.literal('')]).optional(),
  title: z.string().trim().min(1, { error: 'Enter a title.' }),
  notes: z.string().trim().optional(),
  validUntil: z.union([z.iso.date(), z.literal('')]).optional(),
  depositPercent: z.union([z.coerce.number().int().min(0).max(100), z.literal('')]).optional(),
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
    optional: line.optional,
    selected: true,
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
    optional: m.line.optional,
    selected: true,
    sortOrder: i,
  }));

  return { rows, totals };
}

function parseLines(linesJson: string): { data?: z.infer<typeof LineInputSchema>[]; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(linesJson);
  } catch {
    return { error: 'Something went wrong reading the quote lines. Please try again.' };
  }
  const parsed = z.array(LineInputSchema).min(1, { error: 'Add at least one line.' }).safeParse(raw);
  if (!parsed.success) return { error: 'One or more lines are invalid. Check quantities and prices.' };
  return { data: parsed.data };
}

export async function createQuoteAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = QuoteFormSchema.safeParse(Object.fromEntries(formData));
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
  const depositPercent = d.depositPercent || undefined;
  const validUntil = d.validUntil
    ? new Date(d.validUntil)
    : new Date(Date.now() + tenant.defaultQuoteValidDays * 86_400_000);

  const quote = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, tenant.id, 'QUOTE');
    return tx.quote.create({
      data: {
        tenantId: tenant.id,
        number,
        clientId: d.clientId,
        propertyId: d.propertyId || undefined,
        title: d.title,
        notes: d.notes || undefined,
        validUntil,
        depositPercent,
        depositCents: depositPercent ? Math.round((totals.totalCents * depositPercent) / 100) : 0,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        lines: { create: rows },
      },
    });
  });

  revalidatePath('/quotes');
  redirect(`/quotes/${quote.id}`);
}

const UpdateQuoteFormSchema = QuoteFormSchema.and(z.object({ id: z.string().uuid() }));

export async function updateQuoteAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = UpdateQuoteFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const { data: lines, error: linesError } = parseLines(d.linesJson);
  if (linesError) return { error: linesError };

  const db = tenantDb(tenant.id);
  const existing = await db.quote.findUnique({ where: { id: d.id } });
  if (!existing) return { error: 'Quote not found.' };
  // Editing a sent quote puts it back to Draft — it must be re-sent to the client.
  // An approved (or declined/converted) quote is locked; duplicate it instead.
  const EDITABLE_STATUSES = ['DRAFT', 'SENT', 'CHANGES_REQUESTED'];
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    return { error: 'This quote is locked and can no longer be edited. Duplicate it to make changes.' };
  }

  if (d.propertyId) {
    const property = await prisma.property.findFirst({ where: { id: d.propertyId, tenantId: tenant.id, clientId: d.clientId } });
    if (!property) return { error: 'Property not found for this client.' };
  }

  const { rows, totals } = buildLinesAndTotals(lines!, tenant);
  const depositPercent = d.depositPercent || undefined;
  const validUntil = d.validUntil
    ? new Date(d.validUntil)
    : new Date(Date.now() + tenant.defaultQuoteValidDays * 86_400_000);

  await prisma.$transaction([
    prisma.lineItem.deleteMany({ where: { quoteId: d.id } }),
    prisma.quote.update({
      where: { id: d.id },
      data: {
        status: 'DRAFT',
        clientMessage: null,
        propertyId: d.propertyId || null,
        title: d.title,
        notes: d.notes || null,
        validUntil,
        depositPercent: depositPercent ?? null,
        depositCents: depositPercent ? Math.round((totals.totalCents * depositPercent) / 100) : 0,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        lines: { create: rows },
      },
    }),
  ]);

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${d.id}`);
  return { ok: 'Saved.' };
}

export async function sendQuoteAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const id = String(formData.get('id') ?? '');

  const db = tenantDb(tenant.id);
  const existing = await db.quote.findUnique({ where: { id } });
  if (!existing || (existing.status !== 'DRAFT' && existing.status !== 'CHANGES_REQUESTED')) return;

  await db.quote.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), clientMessage: null } });
  revalidatePath(`/quotes/${id}`);
  revalidatePath('/quotes');
}

export async function deleteQuoteAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const id = String(formData.get('id') ?? '');

  const db = tenantDb(tenant.id);
  const existing = await db.quote.findUnique({ where: { id } });
  if (!existing || existing.status !== 'DRAFT') return;

  await db.quote.delete({ where: { id } });
  revalidatePath('/quotes');
}
