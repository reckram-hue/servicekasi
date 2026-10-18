import 'server-only';
import type { TenantDb } from '@/lib/db';
import type { Industry } from '@prisma/client';

/** A short South African trade-business list (decision 2, docs/plans/bookkeeping.md) — each code maps 1-to-1 onto a real accounting code later. */
const DEFAULT_CATEGORIES: { code: string; name: string }[] = [
  { code: '5000', name: 'Materials' },
  { code: '5010', name: 'Fuel' },
  { code: '5020', name: 'Vehicle' },
  { code: '5030', name: 'Tools & equipment' },
  { code: '5040', name: 'Subcontractors' },
  { code: '5050', name: 'Rent' },
  { code: '5060', name: 'Phone & data' },
  { code: '5070', name: 'Bank charges' },
  { code: '5080', name: 'Insurance' },
  { code: '5090', name: 'Salaries & wages' },
  { code: '5100', name: 'Interest' },
  { code: '5999', name: 'Other expenses' },
];

/** Seeds the default category list the first time this tenant opens the cashbook. Safe to call every time. */
export async function ensureDefaultExpenseCategories(db: TenantDb, tenantId: string, industry?: Industry | null): Promise<void> {
  const existing = await db.expenseCategory.count();
  if (existing > 0) return;

  const washNames: Record<string, string> = { '5000': 'Detergents & consumables', '5020': 'Vehicle maintenance & repairs', '5090': 'Labour & wages' };
  for (const category of DEFAULT_CATEGORIES) {
    const c = industry === 'MOBILE_CAR_WASH' ? { ...category, name: washNames[category.code] ?? category.name } : category;
    const ledgerAccount = await db.ledgerAccount.create({ data: { tenantId, kind: 'EXPENSE', code: c.code, name: c.name } });
    await db.expenseCategory.create({ data: { tenantId, ledgerAccountId: ledgerAccount.id, name: c.name } });
  }
}
