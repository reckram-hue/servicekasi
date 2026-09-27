import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { formatDateStr, localDateStr } from '@/lib/dates';
import { moneyAccountHistory } from '@/lib/bookkeeping/queries';
import { MONEY_ACCOUNT_TYPE_LABEL, JOURNAL_SOURCE_LABEL, isLiabilityType } from '@/lib/bookkeeping/labels';

export default async function MoneyAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  const { id } = await params;
  const db = tenantDb(tenant.id);

  const account = await db.moneyAccount.findUnique({ where: { id } });
  if (!account) notFound();

  const history = await moneyAccountHistory(db, account);
  const balanceCents = history.length > 0 ? history[history.length - 1].runningBalanceCents : account.openingBalanceCents;
  const owed = isLiabilityType(account.type) && balanceCents > 0;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/bookkeeping" className="text-sm text-amber-400 hover:underline">
          ← Bookkeeping
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{account.name}</h1>
        <p className="mb-6 text-sm text-slate-500">{MONEY_ACCOUNT_TYPE_LABEL[account.type]}</p>

        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">{owed ? 'You owe' : 'Balance'}</div>
          <div className="mt-1 text-2xl font-bold">{formatMoney(Math.abs(balanceCents), tenant.currencyCode)}</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">History</h2>
          </div>
          {history.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No entries yet.</p>
          ) : (
            history
              .slice()
              .reverse()
              .map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 border-b border-slate-800 p-4 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{h.memo}</div>
                    <div className="text-xs text-slate-500">
                      {formatDateStr(localDateStr(h.date, 'UTC'))} · {JOURNAL_SOURCE_LABEL[h.sourceType]}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-semibold ${h.amountCents >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {h.amountCents >= 0 ? '+' : '−'}
                      {formatMoney(Math.abs(h.amountCents), tenant.currencyCode)}
                    </div>
                    <div className="font-mono text-xs text-slate-500">{formatMoney(h.runningBalanceCents, tenant.currencyCode)}</div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
