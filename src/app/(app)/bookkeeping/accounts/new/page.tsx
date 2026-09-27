import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { todayDateStr } from '@/lib/dates';
import { AddMoneyAccountForm } from '@/components/bookkeeping/AddMoneyAccountForm';

export default async function NewMoneyAccountPage() {
  const { tenant } = await requireRole();

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/bookkeeping" className="text-sm text-amber-400 hover:underline">
          ← Bookkeeping
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">Add account</h1>
        <AddMoneyAccountForm today={todayDateStr(tenant.timezone)} />
      </div>
    </div>
  );
}
