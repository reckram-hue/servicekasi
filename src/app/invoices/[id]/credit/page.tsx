import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { formatMoney, lineTotals } from '@/lib/money';
import { remainingCreditByLine } from '@/lib/invoices/creditNotes';
import { depositDeductedOn } from '@/lib/invoices/deposits';
import { CreditNoteForm } from '@/components/invoices/CreditNoteForm';

export default async function NewCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  const { id } = await params;

  const invoice = await tenantDb(tenant.id).invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: 'asc' } }, client: true },
  });
  if (!invoice) notFound();
  if (invoice.kind === 'CREDIT_NOTE' || invoice.status === 'DRAFT' || invoice.status === 'VOID' || !invoice.number) {
    redirect(`/invoices/${invoice.id}`);
  }

  // Line items aren't tenant-scoped themselves; these ids all belong to this tenant's invoice.
  const remaining = await remainingCreditByLine(prisma, invoice.lines);
  const deductedOn = invoice.isDeposit ? await depositDeductedOn(prisma, invoice.id) : null;
  // "Less: deposit" lines aren't credited themselves; the invoice total already nets them off.
  const creditable = invoice.lines.filter((l) => !l.deductsInvoiceId);
  const hasDeduction = creditable.length < invoice.lines.length;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href={`/invoices/${invoice.id}`} className="text-sm text-amber-400 hover:underline">
          ← {invoice.number}
        </Link>
        <h1 className="mt-2 mb-1 text-2xl font-bold">Credit note</h1>
        <p className="mb-6 text-sm text-slate-400">
          Against {invoice.number} for {invoice.client.firstName} {invoice.client.lastName ?? ''}. Enter how much to credit on each line — all of it,
          or just part. The VAT charged on those lines is credited back with it.
        </p>
        {hasDeduction && (
          <p className="mb-4 rounded-lg bg-slate-800/50 px-3 py-2 text-sm text-slate-400">
            This invoice deducts a deposit, so at most {formatMoney(Math.max(0, invoice.totalCents - invoice.creditedCents), invoice.currencyCode)}{' '}
            (incl. VAT) can be credited on it in total.
          </p>
        )}
        {deductedOn ? (
          <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            This deposit is already deducted on invoice {deductedOn}. Credit that invoice instead, so the client isn&apos;t credited twice.
          </p>
        ) : (
          <CreditNoteForm
            invoiceId={invoice.id}
            invoiceNumber={invoice.number}
            currencyCode={invoice.currencyCode}
            showVat={invoice.kind === 'TAX_INVOICE'}
            lines={creditable.map((l) => ({
              id: l.id,
              description: l.description,
              invoicedCents: lineTotals({
                quantity: Number(l.quantity),
                unitPriceCents: l.unitPriceCents,
              }).subtotalCents,
              remainingCents: remaining.get(l.id)?.cents ?? 0,
              remainingVatCents: remaining.get(l.id)?.vatCents ?? 0,
              taxRateBp: l.taxRateBp,
            }))}
          />
        )}
      </div>
    </div>
  );
}
