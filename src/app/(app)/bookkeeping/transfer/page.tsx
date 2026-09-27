import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { todayDateStr } from '@/lib/dates';
import { moneyAccountsWithBalances } from '@/lib/bookkeeping/queries';
import { AddTransferForm } from '@/components/bookkeeping/AddTransferForm';

export default async function TransferPage() {
  const { tenant } = await requireRole();
  const accounts = await moneyAccountsWithBalances(tenantDb(tenant.id));
  if (accounts.length < 2) redirect('/bookkeeping');

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/bookkeeping" className="text-sm text-amber-400 hover:underline">
          ← Bookkeeping
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">Transfer between accounts</h1>
        <AddTransferForm today={todayDateStr(tenant.timezone)} accounts={accounts} />
      </div>
    </div>
  );
}
