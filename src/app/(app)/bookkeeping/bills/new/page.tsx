import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { todayDateStr } from '@/lib/dates';
import { canUse } from '@/lib/plans/plans';
import { ensureDefaultExpenseCategories } from '@/lib/bookkeeping/categories';
import { activeExpenseCategories } from '@/lib/bookkeeping/queries';
import { AddBillForm } from '@/components/bookkeeping/AddBillForm';

export default async function NewBillPage() {
  const { tenant } = await requireRole();
  if (!canUse(tenant, 'creditors')) redirect('/bookkeeping/bills');

  const db = tenantDb(tenant.id);
  await ensureDefaultExpenseCategories(db, tenant.id);
  const categories = await activeExpenseCategories(db);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/bookkeeping/bills" className="text-sm text-amber-400 hover:underline">
          ← Who you owe
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">Add bill</h1>
        <AddBillForm today={todayDateStr(tenant.timezone)} categories={categories} />
      </div>
    </div>
  );
}
