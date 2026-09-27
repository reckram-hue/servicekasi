import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { ensureDefaultExpenseCategories } from '@/lib/bookkeeping/categories';
import { activeExpenseCategories } from '@/lib/bookkeeping/queries';
import { CategoriesManager } from '@/components/bookkeeping/CategoriesManager';

export default async function ExpenseCategoriesPage() {
  const { tenant } = await requireRole();
  const db = tenantDb(tenant.id);

  await ensureDefaultExpenseCategories(db, tenant.id);
  const categories = await activeExpenseCategories(db);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/bookkeeping" className="text-sm text-amber-400 hover:underline">
          ← Bookkeeping
        </Link>
        <h1 className="mt-2 mb-1 text-2xl font-bold">Expense categories</h1>
        <p className="mb-6 text-sm text-slate-500">Rename any of these, or add your own. Nothing already used can be removed — it stays so old expenses keep their history.</p>
        <CategoriesManager categories={categories} />
      </div>
    </div>
  );
}
