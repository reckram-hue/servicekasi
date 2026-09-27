import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { formatDateStr, localDateStr, todayDateStr } from '@/lib/dates';
import { canUse } from '@/lib/plans/plans';
import { billWithPayments, moneyAccountsWithBalances } from '@/lib/bookkeeping/queries';
import { BILL_STATUS_LABEL, VAT_STATUS_LABEL } from '@/lib/bookkeeping/labels';
import { PayBillForm } from '@/components/bookkeeping/PayBillForm';

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  if (!canUse(tenant, 'creditors')) redirect('/bookkeeping/bills');

  const { id } = await params;
  const db = tenantDb(tenant.id);
  const [bill, moneyAccounts] = await Promise.all([billWithPayments(db, id), moneyAccountsWithBalances(db)]);
  if (!bill) notFound();

  const balanceCents = bill.amountCents - bill.paidCents;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/bookkeeping/bills" className="text-sm text-amber-400 hover:underline">
          ← Who you owe
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{bill.supplier}</h1>
        <p className="mb-6 text-sm text-slate-500">
          Due {formatDateStr(localDateStr(bill.dueDate, 'UTC'))} · {bill.category.name} · {VAT_STATUS_LABEL[bill.vatStatus]}
        </p>

        {bill.slipUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bill.slipUrl} alt="Bill" className="mb-6 h-40 w-full rounded-xl object-cover" />
        )}

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total</div>
            <div className="mt-1 text-xl font-bold">{formatMoney(bill.amountCents, tenant.currencyCode)}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{bill.status === 'PAID' ? 'Status' : 'Balance due'}</div>
            <div className="mt-1 text-xl font-bold">{bill.status === 'PAID' ? BILL_STATUS_LABEL.PAID : formatMoney(balanceCents, tenant.currencyCode)}</div>
          </div>
        </div>

        {bill.note && <p className="mb-6 text-sm text-slate-400">{bill.note}</p>}

        {bill.billPayments.length > 0 && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 p-4">
              <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Payments</h2>
            </div>
            {bill.billPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-slate-800 p-4 text-sm last:border-0">
                <span className="text-slate-300">
                  {formatDateStr(localDateStr(p.date, 'UTC'))} · {p.moneyAccount.name}
                </span>
                <span className="font-mono font-semibold">{formatMoney(p.amountCents, tenant.currencyCode)}</span>
              </div>
            ))}
          </div>
        )}

        {bill.status !== 'PAID' && (
          <PayBillForm billId={bill.id} balanceCents={balanceCents} today={todayDateStr(tenant.timezone)} moneyAccounts={moneyAccounts} />
        )}
      </div>
    </div>
  );
}
