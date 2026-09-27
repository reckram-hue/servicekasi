import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { formatDateStr, localDateStr } from '@/lib/dates';
import { expenseMonthlyLimit, canUse, PLAN_LABEL } from '@/lib/plans/plans';
import { currentMonthRange } from '@/lib/bookkeeping/dates';
import {
  moneyAccountsWithBalances,
  recentExpenses,
  monthExpenseTotalCents,
  monthExpenseCount,
  monthInvoiceIncomeCents,
} from '@/lib/bookkeeping/queries';
import { MONEY_ACCOUNT_TYPE_LABEL, isLiabilityType } from '@/lib/bookkeeping/labels';

export default async function BookkeepingPage() {
  const { tenant } = await requireRole();
  const db = tenantDb(tenant.id);
  const { start, end } = currentMonthRange(tenant.timezone);

  const [accounts, expenses, monthOutCents, monthCount, monthInCents] = await Promise.all([
    moneyAccountsWithBalances(db),
    recentExpenses(db, 20),
    monthExpenseTotalCents(db, start, end),
    monthExpenseCount(db, start, end),
    monthInvoiceIncomeCents(db, tenant.id, start, end),
  ]);

  const limit = expenseMonthlyLimit(tenant);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Bookkeeping — {tenant.businessName}</h1>
          <div className="flex flex-wrap gap-2">
            {canUse(tenant, 'creditors') && (
              <Link href="/bookkeeping/bills" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500">
                Who you owe
              </Link>
            )}
            <Link href="/bookkeeping/categories" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500">
              Categories
            </Link>
            <Link href="/bookkeeping/expenses/new" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
              + Add expense
            </Link>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Money in this month</div>
            <div className="mt-1 text-2xl font-bold text-emerald-400">{formatMoney(monthInCents, tenant.currencyCode)}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Money out this month</div>
            <div className="mt-1 text-2xl font-bold">{formatMoney(monthOutCents, tenant.currencyCode)}</div>
            {limit != null && (
              <p className="mt-1 text-xs text-slate-500">
                {monthCount} of {limit} expenses used on {PLAN_LABEL.FREE_SOLO}.{' '}
                {monthCount >= limit && (
                  <Link href="/settings/package" className="font-semibold text-amber-400 hover:underline">
                    Upgrade →
                  </Link>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Accounts</h2>
            <div className="flex gap-3 text-sm">
              {accounts.length >= 2 && (
                <Link href="/bookkeeping/transfer" className="text-amber-400 hover:underline">
                  Transfer
                </Link>
              )}
              <Link href="/bookkeeping/accounts/new" className="text-amber-400 hover:underline">
                + Add account
              </Link>
            </div>
          </div>
          {accounts.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No money accounts yet — add your bank account or petty cash to start tracking balances.</p>
          ) : (
            accounts.map((a) => (
              <Link
                key={a.id}
                href={`/bookkeeping/accounts/${a.id}`}
                className="flex items-center justify-between border-b border-slate-800 p-4 last:border-0 hover:bg-slate-800/40"
              >
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-slate-500">{MONEY_ACCOUNT_TYPE_LABEL[a.type]}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">{formatMoney(Math.abs(a.balanceCents), tenant.currencyCode)}</div>
                  {isLiabilityType(a.type) && a.balanceCents > 0 && <div className="text-xs text-amber-400">you owe</div>}
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-4">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Recent expenses</h2>
          </div>
          {expenses.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No expenses recorded yet.</p>
          ) : (
            expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 border-b border-slate-800 p-4 last:border-0">
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.supplier || e.category.name}</div>
                  <div className="text-xs text-slate-500">
                    {formatDateStr(localDateStr(e.date, 'UTC'))} · {e.category.name} · {e.moneyAccount.name}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {e.slipUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.slipUrl} alt="Slip" className="h-8 w-8 rounded object-cover" />
                  )}
                  <div className="font-mono font-semibold">{formatMoney(e.amountCents, tenant.currencyCode)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
