'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { MoneyAccountType, ExpenseVatStatus } from '@prisma/client';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth/session';
import { parseMoneyInput, formatMoney } from '@/lib/money';
import { uploadPublicFile } from '@/lib/storage';
import { expenseMonthlyLimit, PLAN_LABEL } from '@/lib/plans/plans';
import { ensureDefaultExpenseCategories } from '@/lib/bookkeeping/categories';
import { createMoneyAccountWithOpeningBalance, postExpenseEntry, postTransfer } from '@/lib/bookkeeping/ledger';
import { currentMonthRange } from '@/lib/bookkeeping/dates';

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; ok?: string } | undefined;

const AddMoneyAccountSchema = z.object({
  type: z.enum(MoneyAccountType),
  name: z.string().trim().min(1, { error: 'Give this account a name.' }).max(100),
  openingBalance: z.string().trim().default('0'),
  openingDate: z.iso.date({ error: 'Choose a date.' }),
});

export async function addMoneyAccountAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = AddMoneyAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const openingBalanceCents = parseMoneyInput(d.openingBalance || '0');
  if (openingBalanceCents === null || openingBalanceCents < 0) {
    return { fieldErrors: { openingBalance: ['Enter a valid amount, 0 or more.'] } };
  }

  await createMoneyAccountWithOpeningBalance(tenantDb(tenant.id), tenant.id, {
    type: d.type,
    name: d.name,
    openingBalanceCents,
    openingDate: new Date(`${d.openingDate}T00:00:00Z`),
  });

  revalidatePath('/bookkeeping');
  redirect('/bookkeeping');
}

/** Uploads a slip photo the moment it's taken, ahead of the rest of the form — the same pattern as job/visit photos. */
export async function uploadExpenseSlipAction(formData: FormData): Promise<{ url?: string; mimeType?: string; error?: string }> {
  const { tenant } = await requireRole();
  const photo = formData.get('photo');
  if (!(photo instanceof Blob) || photo.size === 0) return { error: 'Choose a photo first.' };
  if (photo.type !== 'image/jpeg' && photo.type !== 'image/png') return { error: 'Unsupported photo format.' };
  const contentType = photo.type as 'image/jpeg' | 'image/png';

  try {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const url = await uploadPublicFile(tenant.id, buffer, contentType);
    return { url, mimeType: contentType };
  } catch {
    return { error: 'Could not upload that photo — check your connection and try again.' };
  }
}

const AddExpenseSchema = z.object({
  date: z.iso.date({ error: 'Choose a date.' }),
  amount: z.string().trim().min(1, { error: 'Enter an amount.' }),
  supplier: z.string().trim().max(200).optional(),
  categoryId: z.string().uuid({ error: 'Choose a category.' }),
  moneyAccountId: z.string().uuid({ error: 'Choose which account this was paid from.' }),
  vatStatus: z.enum(ExpenseVatStatus),
  note: z.string().trim().max(500).optional(),
  slipUrl: z.string().trim().optional(),
  slipMimeType: z.string().trim().optional(),
  clientGeneratedId: z.string().trim().min(1),
});

/** Records an expense — the "no more box of paper slips" feature. Call uploadExpenseSlipAction first and pass its url/mimeType through as plain fields. */
export async function addExpenseAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant, membership } = await requireRole();
  const parsed = AddExpenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const amountCents = parseMoneyInput(d.amount);
  if (amountCents === null || amountCents <= 0) return { fieldErrors: { amount: ['Enter a valid amount more than zero.'] } };

  const db = tenantDb(tenant.id);

  const existing = await db.expense.findUnique({ where: { clientGeneratedId: d.clientGeneratedId } });
  if (existing) return { ok: 'Expense saved.' }; // already saved — a flaky connection retried the submit

  const limit = expenseMonthlyLimit(tenant);
  if (limit != null) {
    const { start, end } = currentMonthRange(tenant.timezone);
    const countThisMonth = await db.expense.count({ where: { date: { gte: start, lt: end } } });
    if (countThisMonth >= limit) {
      return { error: `${PLAN_LABEL.FREE_SOLO} is limited to ${limit} expenses a month. Upgrade to ${PLAN_LABEL.TEAM} for unlimited.` };
    }
  }

  const category = await db.expenseCategory.findUnique({ where: { id: d.categoryId }, select: { ledgerAccountId: true, name: true } });
  const moneyAccount = await db.moneyAccount.findUnique({ where: { id: d.moneyAccountId }, select: { ledgerAccountId: true, archived: true } });
  if (!category) return { fieldErrors: { categoryId: ['Category not found.'] } };
  if (!moneyAccount || moneyAccount.archived) return { fieldErrors: { moneyAccountId: ['Account not found.'] } };

  const date = new Date(`${d.date}T00:00:00Z`);
  const memo = `${d.supplier ? `${d.supplier} — ` : ''}${category.name}`;

  const entry = await postExpenseEntry(db, tenant.id, {
    date,
    memo,
    categoryLedgerAccountId: category.ledgerAccountId,
    moneyAccountLedgerId: moneyAccount.ledgerAccountId,
    amountCents,
  });

  await db.expense.create({
    data: {
      tenantId: tenant.id,
      date,
      amountCents,
      supplier: d.supplier || undefined,
      categoryId: d.categoryId,
      moneyAccountId: d.moneyAccountId,
      vatStatus: d.vatStatus,
      note: d.note || undefined,
      slipUrl: d.slipUrl || undefined,
      slipMimeType: d.slipMimeType || undefined,
      createdByMembershipId: membership.id,
      clientGeneratedId: d.clientGeneratedId,
      journalEntryId: entry.id,
    },
  });

  revalidatePath('/bookkeeping');
  return { ok: `Saved ${formatMoney(amountCents, tenant.currencyCode)} to ${category.name}.` };
}

const AddCategorySchema = z.object({ name: z.string().trim().min(1, { error: 'Give this category a name.' }).max(100) });

export async function addExpenseCategoryAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = AddCategorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const db = tenantDb(tenant.id);
  await ensureDefaultExpenseCategories(db, tenant.id);

  const ledgerAccount = await db.ledgerAccount.create({
    data: { tenantId: tenant.id, kind: 'EXPENSE', code: `USR-${randomUUID().slice(0, 6).toUpperCase()}`, name: parsed.data.name },
  });
  await db.expenseCategory.create({ data: { tenantId: tenant.id, ledgerAccountId: ledgerAccount.id, name: parsed.data.name } });

  revalidatePath('/bookkeeping/categories');
  return { ok: 'Category added.' };
}

const RenameCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, { error: 'Give this category a name.' }).max(100),
});

export async function renameExpenseCategoryAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = RenameCategorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const db = tenantDb(tenant.id);
  const category = await db.expenseCategory.findUnique({ where: { id: parsed.data.id }, select: { ledgerAccountId: true } });
  if (!category) return { error: 'Category not found.' };

  await Promise.all([
    db.expenseCategory.update({ where: { id: parsed.data.id }, data: { name: parsed.data.name } }),
    db.ledgerAccount.update({ where: { id: category.ledgerAccountId }, data: { name: parsed.data.name } }),
  ]);

  revalidatePath('/bookkeeping/categories');
  return { ok: 'Category renamed.' };
}

const AddTransferSchema = z.object({
  date: z.iso.date({ error: 'Choose a date.' }),
  fromMoneyAccountId: z.string().uuid({ error: 'Choose the account money is coming from.' }),
  toMoneyAccountId: z.string().uuid({ error: 'Choose the account money is going to.' }),
  amount: z.string().trim().min(1, { error: 'Enter an amount.' }),
  interestAmount: z.string().trim().optional(),
  memo: z.string().trim().max(200).optional(),
});

/** Moves money between two of the business's own accounts — drawing petty cash, repaying a loan (with an optional interest split). */
export async function addTransferAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = AddTransferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  if (d.fromMoneyAccountId === d.toMoneyAccountId) return { error: "Choose two different accounts." };

  const principalCents = parseMoneyInput(d.amount);
  if (principalCents === null || principalCents <= 0) return { fieldErrors: { amount: ['Enter a valid amount more than zero.'] } };

  let interestCents: number | undefined;
  if (d.interestAmount?.trim()) {
    interestCents = parseMoneyInput(d.interestAmount) ?? undefined;
    if (interestCents == null || interestCents < 0) return { fieldErrors: { interestAmount: ['Enter a valid amount, 0 or more.'] } };
  }

  const db = tenantDb(tenant.id);
  const [from, to] = await Promise.all([
    db.moneyAccount.findUnique({ where: { id: d.fromMoneyAccountId }, select: { ledgerAccountId: true, name: true, archived: true } }),
    db.moneyAccount.findUnique({ where: { id: d.toMoneyAccountId }, select: { ledgerAccountId: true, name: true, archived: true } }),
  ]);
  if (!from || from.archived) return { fieldErrors: { fromMoneyAccountId: ['Account not found.'] } };
  if (!to || to.archived) return { fieldErrors: { toMoneyAccountId: ['Account not found.'] } };

  let interestCategory: { ledgerAccountId: string } | null = null;
  if (interestCents && interestCents > 0) {
    await ensureDefaultExpenseCategories(db, tenant.id);
    interestCategory = await db.expenseCategory.findFirst({ where: { name: 'Interest' }, select: { ledgerAccountId: true } });
  }

  await postTransfer(db, tenant.id, {
    date: new Date(`${d.date}T00:00:00Z`),
    memo: d.memo?.trim() || `Transfer: ${from.name} → ${to.name}`,
    fromLedgerAccountId: from.ledgerAccountId,
    toLedgerAccountId: to.ledgerAccountId,
    principalCents,
    interestCents,
    interestCategoryLedgerAccountId: interestCategory?.ledgerAccountId,
  });

  revalidatePath('/bookkeeping');
  return { ok: `Transferred ${formatMoney(principalCents, tenant.currencyCode)}.` };
}
