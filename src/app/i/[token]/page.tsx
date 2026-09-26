import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicInvoiceByToken, invoiceDocumentProps } from '@/lib/invoices/publicQuery';
import { isInvoiceOverdue } from '@/lib/invoices/status';
import { formatMoney } from '@/lib/money';
import { invoiceBalanceCents } from '@/lib/invoices/payments';
import { InvoiceDocument } from '@/components/invoices/InvoiceDocument';
import { PrintButton } from '@/components/invoices/PrintButton';
import { PayNowButton } from '@/components/payments/PayNowButton';
import { activePaymentAccount } from '@/lib/payments/accounts';

// Invoices carry personal details: keep them out of search engines.
export const metadata: Metadata = { title: 'Invoice', robots: { index: false, follow: false } };

export default async function PublicInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;
  const invoice = await getPublicInvoiceByToken(token);
  if (!invoice) notFound();

  const businessName = invoice.tenant.tradingName || invoice.tenant.businessName;
  const doc = invoice.status === 'DRAFT' ? null : invoiceDocumentProps(invoice, invoice.tenant);
  const contact = [invoice.tenant.phone, invoice.tenant.email].filter(Boolean).join(' or ');

  if (!doc) {
    return (
      <Shell>
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
          This invoice from {businessName} isn&apos;t ready yet. Please contact them if you were expecting one.
        </p>
      </Shell>
    );
  }

  if (invoice.status === 'VOID') {
    return (
      <Shell>
        <p className="rounded-xl border border-slate-700 p-6 text-center text-slate-300">
          Invoice {invoice.number} from {businessName} has been cancelled. Nothing is owed on it.
        </p>
      </Shell>
    );
  }

  const balanceCents = invoiceBalanceCents(invoice);
  const overdue = isInvoiceOverdue(invoice);
  const canPayOnline = !doc.creditNote && balanceCents > 0 && !!(await activePaymentAccount(invoice.tenantId, invoice.currencyCode));
  const settledMessage =
    balanceCents < 0
      ? `A refund of ${formatMoney(-balanceCents, invoice.currencyCode)} is due to you.`
      : invoice.creditedCents >= invoice.totalCents
        ? 'This invoice has been credited in full. Nothing is owed.'
        : 'Paid in full. Thank you!';

  return (
    <Shell>
      {doc.creditNote && (
        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-center text-slate-200 print:hidden">
          Credit note {invoice.number} reduces what you owe on invoice{' '}
          <span className="font-semibold">{doc.creditNote.invoiceNumber}</span> by{' '}
          <span className="font-semibold">{formatMoney(invoice.totalCents, invoice.currencyCode)}</span>.
        </div>
      )}
      {!doc.creditNote && invoice.status === 'PAID' && (
        <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-500/10 p-4 text-center font-semibold text-emerald-300 print:hidden">
          {settledMessage}
        </div>
      )}
      {paid && invoice.status !== 'PAID' && !doc.creditNote && (
        <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-500/10 p-4 text-center text-emerald-200 print:hidden">
          Thank you! Your payment is being confirmed. This page will show &quot;Paid&quot; within a few minutes. Refresh to check.
        </div>
      )}
      {!doc.creditNote && invoice.status !== 'PAID' && (
        <div
          className={`mb-4 rounded-xl border p-4 text-center print:hidden ${
            overdue ? 'border-amber-700 bg-amber-500/10 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-200'
          }`}
        >
          <div className="text-xs uppercase tracking-wide text-slate-400">{overdue ? 'Overdue' : 'Amount due'}</div>
          <div className="text-2xl font-bold">{formatMoney(balanceCents, invoice.currencyCode)}</div>
          {invoice.tenant.bankAccountNumber && (
            <div className="mt-1 text-sm text-slate-400">
              {canPayOnline ? 'Or pay' : 'Pay'} by EFT using <span className="font-semibold text-slate-200">{invoice.number}</span> as your
              reference.
            </div>
          )}
          {canPayOnline && !paid && <PayNowButton publicToken={token} label={`Pay ${formatMoney(balanceCents, invoice.currencyCode)} now`} />}
          {canPayOnline && !paid && <p className="mt-2 text-xs text-slate-500">Card, Instant EFT, Capitec Pay or SnapScan, via PayFast.</p>}
        </div>
      )}

      <InvoiceDocument {...doc} />

      <div className="mt-4 flex flex-col items-center gap-2 print:hidden">
        <PrintButton className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700" />
        {contact && (
          <p className="text-xs text-slate-500">
            Questions about this {doc.creditNote ? 'credit note' : 'invoice'}? Contact {businessName} on {contact}.
          </p>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl print:max-w-none">{children}</div>
    </div>
  );
}
