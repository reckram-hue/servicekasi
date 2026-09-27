import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { todayDateStr } from '@/lib/dates';
import { ensureDefaultExpenseCategories } from '@/lib/bookkeeping/categories';
import { activeExpenseCategories, moneyAccountsWithBalances } from '@/lib/bookkeeping/queries';
import { AddExpenseForm } from '@/components/bookkeeping/AddExpenseForm';

export default async function NewExpensePage() {
  const { tenant } = await requireRole();
  const db = tenantDb(tenant.id);

  await ensureDefaultExpenseCategories(db, tenant.id);
  const [categories, moneyAccounts] = await Promise.all([activeExpenseCategories(db), moneyAccountsWithBalances(db)]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/bookkeeping" className="text-sm text-amber-400 hover:underline">
          ← Bookkeeping
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">Add expense</h1>
        <AddExpenseForm today={todayDateStr(tenant.timezone)} categories={categories} moneyAccounts={moneyAccounts} />
        {moneyAccounts.length > 0 && (
          <p className="mt-4 text-center text-xs text-slate-500">
            Adding a category?{' '}
            <Link href="/bookkeeping/categories" className="text-amber-400 hover:underline">
              Manage categories
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
