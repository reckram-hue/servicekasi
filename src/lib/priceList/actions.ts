'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CatalogItemType, Industry } from '@prisma/client';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth/session';
import { parseMoneyInput } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { INDUSTRY_LABELS } from '@/lib/onboarding/industries';
import { addStarterPriceList } from '@/lib/onboarding/starterPriceList';

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; ok?: string } | undefined;

/** Accepts a Rand amount as typed ("450", "1 250,50") and stores it as cents. */
const moneyField = (opts: { required?: boolean } = {}) =>
  z.string().trim().transform((val, ctx) => {
    if (!val) {
      if (opts.required) {
        ctx.addIssue({ code: 'custom', message: 'Enter an amount.' });
        return z.NEVER;
      }
      return 0;
    }
    const cents = parseMoneyInput(val);
    if (cents === null || cents < 0) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid amount, e.g. 450 or 1 250,50.' });
      return z.NEVER;
    }
    return cents;
  });

const CatalogItemSchema = z.object({
  type: z.enum(CatalogItemType, { error: 'Choose a type.' }),
  name: z.string().trim().min(1, { error: 'Enter a name.' }),
  description: z.string().trim().optional(),
  unitCostCents: moneyField(),
  unitPriceCents: moneyField({ required: true }),
  taxable: z.union([z.literal('on'), z.literal('')]).optional(),
});

export async function createCatalogItemAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const parsed = CatalogItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const db = tenantDb(tenant.id);
  await db.catalogItem.create({
    data: {
      tenantId: tenant.id, // tenantDb also injects this; kept explicit to satisfy TypeScript
      type: d.type,
      name: d.name,
      description: d.description || undefined,
      unitCostCents: d.unitCostCents,
      unitPriceCents: d.unitPriceCents,
      taxable: d.taxable === 'on',
    },
  });

  revalidatePath('/settings/price-list');
  return { ok: `${d.name} was added.` };
}

const UpdateCatalogItemSchema = CatalogItemSchema.and(z.object({ id: z.string().uuid() }));

export async function updateCatalogItemAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const parsed = UpdateCatalogItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const db = tenantDb(tenant.id);
  const existing = await db.catalogItem.findUnique({ where: { id: d.id } });
  if (!existing) return { error: 'Item not found.' };

  await db.catalogItem.update({
    where: { id: d.id },
    data: {
      type: d.type,
      name: d.name,
      description: d.description || null,
      unitCostCents: d.unitCostCents,
      unitPriceCents: d.unitPriceCents,
      taxable: d.taxable === 'on',
    },
  });

  revalidatePath('/settings/price-list');
  return { ok: 'Saved.' };
}

export async function toggleActiveCatalogItemAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const id = String(formData.get('id') ?? '');
  const currentlyActive = formData.get('active') === 'true';

  const db = tenantDb(tenant.id);
  await db.catalogItem.update({ where: { id }, data: { active: !currentlyActive } });
  revalidatePath('/settings/price-list');
}

const StarterSchema = z.object({ industry: z.enum(Industry, { error: 'Choose a trade.' }) });

export async function addStarterItemsAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const parsed = StarterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { industry } = parsed.data;

  const { added, skipped } = await addStarterPriceList(tenantDb(tenant.id), tenant.id, industry);
  // The first trade picked becomes the business's trade; adding another trade's items later doesn't change it.
  if (!tenant.industry) await prisma.tenant.update({ where: { id: tenant.id }, data: { industry } });

  revalidatePath('/settings/price-list');
  const label = INDUSTRY_LABELS[industry];
  if (added === 0) return { ok: `You already have all the ${label} starter items.` };
  return {
    ok: `Added ${added} ${label} item${added === 1 ? '' : 's'}.${skipped ? ` Skipped ${skipped} you already had.` : ''} Change the prices to your own below.`,
  };
}
