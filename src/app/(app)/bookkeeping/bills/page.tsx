import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { formatDateStr, localDateStr } from '@/lib/dates';
import { canUse, minimumPlanFor, PLAN_LABEL } from '@/lib/plans/plans';
import { openBills } from '@/lib/bookkeeping/queries';
import { BILL_STATUS_LABEL } from '@/lib/bookkeeping/labels';

export default async function BillsPage() {
  const { tenant } = await requireRole();

  if (!canUse(tenant, 'creditors')) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-2xl">
          <Link href="/bookkeeping" className="text-sm text-amber-400 hover:underline">
            ← Bookkeeping
          </Link>
          <h1 className="mt-2 mb-6 text-2xl font-bold">Who you owe</h1>
          <div className="rounded-xl border border-amber-800 bg-amber-500/10 p-4 text-sm text-amber-200">
            <p className="mb-3">
              Supplier bills are part of the {PLAN_LABEL[minimumPlanFor('creditors')]} package. Upgrade to keep tracking who you owe.
            </p>
            <Link href="/settings/package" className="inline-block rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-400">
              See packages
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const bills = await openBills(tenantDb(tenant.id));
  const today = localDateStr(new Date(), tenant.timezone);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/bookkeeping" className="text-sm text-amber-400 hover:underline">
          ← Bookkeeping
        </Link>
        <div className="mt-2 mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Who you owe</h1>
          <Link href="/bookkeeping/bills/new" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
            + Add bill
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900">
          {bills.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Nothing owed right now.</p>
          ) : (
            bills.map((b) => {
              const balanceCents = b.amountCents - b.paidCents;
              const overdue = localDateStr(b.dueDate, 'UTC') < today;
              return (
                <Link
                  key={b.id}
                  href={`/bookkeeping/bills/${b.id}`}
                  className="flex items-center justify-between gap-3 border-b border-slate-800 p-4 last:border-0 hover:bg-slate-800/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{b.supplier}</span>
                      {overdue && <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300">Overdue</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      Due {formatDateStr(localDateStr(b.dueDate, 'UTC'))} · {b.category.name} · {BILL_STATUS_LABEL[b.status]}
                    </div>
                  </div>
                  <div className="font-mono font-semibold">{formatMoney(balanceCents, tenant.currencyCode)}</div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
