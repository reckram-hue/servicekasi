import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { addDaysToDateStr, todayDateStr } from '@/lib/dates';
import { invoiceDocumentProps } from '@/lib/invoices/publicQuery';
import { invoiceBadge, isInvoiceOverdue } from '@/lib/invoices/status';
import { invoiceBalanceCents } from '@/lib/invoices/payments';
import { depositDeductionRows } from '@/lib/invoices/deposits';
import { prisma } from '@/lib/prisma';
import { PAYMENT_METHOD_LABELS } from '@/lib/invoices/paymentMethods';
import { reversePaymentAction } from '@/lib/invoices/actions';
import { moneyAccountsWithBalances } from '@/lib/bookkeeping/queries';
import { InvoiceBuilder } from '@/components/invoices/InvoiceBuilder';
import { InvoiceDocument } from '@/components/invoices/InvoiceDocument';
import { SendInvoiceButton } from '@/components/invoices/SendInvoiceButton';
import { PrintButton } from '@/components/invoices/PrintButton';
import { RecordPaymentForm } from '@/components/invoices/RecordPaymentForm';
import { ReversePaymentButton } from '@/components/invoices/ReversePaymentButton';

function displayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

function propertyLabel(p: { street: string; suburb: string | null; city: string }) {
  return [p.street, p.suburb, p.city].filter(Boolean).join(', ');
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const protocol = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  const { id } = await params;

  const db = tenantDb(tenant.id);
  const [invoice, catalogItems, origin, moneyAccounts] = await Promise.all([
    db.invoice.findUnique({
      where: { id },
      include: {
        client: { include: { properties: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        // Pending/failed rows are online checkouts the client didn't finish: not money received.
        payments: { where: { status: 'SUCCEEDED' }, orderBy: { createdAt: 'asc' } },
        job: true,
        quote: { select: { id: true, number: true } },
        creditNotes: {
          where: { kind: 'CREDIT_NOTE', status: { not: 'DRAFT' } },
          select: { id: true, number: true, totalCents: true, issuedAt: true, notes: true },
          orderBy: { issuedAt: 'asc' },
        },
        creditsInvoice: { select: { id: true, number: true, kind: true } },
      },
    }),
    db.catalogItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    siteOrigin(),
    moneyAccountsWithBalances(db),
  ]);
  if (!invoice) notFound();

  // What saving this draft would deduct right now (saving recalculates it the same way).
  const deductions =
    invoice.status === 'DRAFT' && invoice.jobId && !invoice.isDeposit
      ? await depositDeductionRows(prisma, { tenantId: tenant.id, jobId: invoice.jobId, forInvoiceId: invoice.id, lock: false })
      : [];

  const today = todayDateStr(tenant.timezone);
  const doc = invoice.status === 'DRAFT' ? null : invoiceDocumentProps(invoice, tenant);
  const publicUrl = `${origin}/i/${invoice.publicToken}`;
  const overdue = isInvoiceOverdue(invoice);
  const businessName = tenant.tradingName || tenant.businessName;
  const isCreditNote = invoice.kind === 'CREDIT_NOTE';
  const badge = invoiceBadge(invoice);
  const balanceCents = invoiceBalanceCents(invoice);
  const canCredit = !isCreditNote && invoice.status !== 'DRAFT' && invoice.status !== 'VOID' && invoice.creditedCents < invoice.totalCents;
  const dueDay = invoice.dueAt?.toISOString().slice(0, 10);
  const dueText =
    dueDay && invoice.issuedAt && dueDay > invoice.issuedAt.toLocaleDateString('en-CA', { timeZone: tenant.timezone })
      ? `, due ${new Date(`${dueDay}T00:00:00Z`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`
      : '';
  const whatsappMessage = isCreditNote
    ? `Hi ${invoice.client.firstName}, here's credit note ${invoice.number} from ${businessName} for ${formatMoney(invoice.totalCents, invoice.currencyCode)} against invoice ${invoice.creditsInvoice?.number}. View it here: ${publicUrl}`
    : balanceCents > 0
      ? `Hi ${invoice.client.firstName}, here's invoice ${invoice.number} from ${businessName} for ${formatMoney(balanceCents, invoice.currencyCode)}${dueText}. View it here: ${publicUrl}`
      : balanceCents < 0
        ? `Hi ${invoice.client.firstName}, here's invoice ${invoice.number} from ${businessName}. After the credit note, a refund of ${formatMoney(-balanceCents, invoice.currencyCode)} is due to you. View it here: ${publicUrl}`
        : `Hi ${invoice.client.firstName}, here's invoice ${invoice.number} from ${businessName}. Nothing is owed on it. View it here: ${publicUrl}`;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl print:max-w-none">
        <Link href="/invoices" className="text-sm text-amber-400 hover:underline print:hidden">
          ← Invoices
        </Link>
        <div className="mt-2 mb-2 flex items-center justify-between print:hidden">
          <h1 className="text-2xl font-bold">
            {invoice.number ?? 'Draft invoice'}
            <span className="ml-2 text-base font-normal text-slate-400">{displayName(invoice.client)}</span>
          </h1>
          <div className="flex items-center gap-2">
            {overdue && <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">Overdue</span>}
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.style}`}>{badge.label}</span>
          </div>
        </div>

        {invoice.creditsInvoice && (
          <p className="mb-6 text-sm text-slate-500 print:hidden">
            Credits invoice{' '}
            <Link href={`/invoices/${invoice.creditsInvoice.id}`} className="text-amber-400 hover:underline">
              {invoice.creditsInvoice.number}
            </Link>
          </p>
        )}

        {(invoice.job || invoice.quote) && (
          <p className="mb-6 text-sm text-slate-500 print:hidden">
            {invoice.isDeposit && invoice.quote && (
              <>
                Deposit for quote{' '}
                <Link href={`/quotes/${invoice.quote.id}`} className="text-amber-400 hover:underline">
                  {invoice.quote.number}
                </Link>
                {invoice.job && ' · '}
              </>
            )}
            {invoice.job && (
              <>
                {invoice.isDeposit ? 'job' : 'From job'}{' '}
                <Link href={`/jobs/${invoice.job.id}`} className="text-amber-400 hover:underline">
                  {invoice.job.number}
                </Link>
              </>
            )}
          </p>
        )}

        {doc ? (
          <>
            <div className="mb-6 print:hidden">
              <SendInvoiceButton publicUrl={publicUrl} clientPhone={invoice.client.phone} message={whatsappMessage} />
            </div>
            <InvoiceDocument {...doc} />
            <div className="mt-4 flex items-center justify-between gap-3 print:hidden">
              <p className="text-xs text-slate-500">
                {isCreditNote ? 'Credit notes are locked once issued.' : 'Issued invoices are locked. Mistakes are corrected with a credit note.'}
              </p>
              <PrintButton className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700" />
            </div>

            <div className="mt-8 space-y-4 print:hidden">
              {(invoice.creditNotes.length > 0 || canCredit) && (
                <div className="rounded-xl border border-slate-800 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Credit notes</h2>
                    {canCredit && (
                      <Link
                        href={`/invoices/${invoice.id}/credit`}
                        className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                      >
                        + Credit note
                      </Link>
                    )}
                  </div>
                  {invoice.creditNotes.length === 0 ? (
                    <p className="text-xs text-slate-500">Made a mistake, or giving money back? Issue a credit note for some or all of this invoice.</p>
                  ) : (
                    <div className="space-y-2">
                      {invoice.creditNotes.map((c) => (
                        <Link
                          key={c.id}
                          href={`/invoices/${c.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900"
                        >
                          <span>
                            <span className="font-medium text-slate-100">{c.number}</span>
                            {c.notes && <span className="ml-2 text-slate-400">{c.notes}</span>}
                          </span>
                          <span className="text-slate-300">− {formatMoney(c.totalCents, invoice.currencyCode)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {invoice.payments.length > 0 && (
                <div className="rounded-xl border border-slate-800 p-4">
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Payments</h2>
                  <div className="space-y-2">
                    {invoice.payments.map((p) => (
                      <div
                        key={p.id}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm ${p.reversedAt ? 'opacity-50' : ''}`}
                      >
                        <div>
                          <span className={p.reversedAt ? 'line-through' : 'font-medium text-slate-100'}>
                            {formatMoney(Math.abs(p.amountCents), invoice.currencyCode)}
                          </span>
                          <span className="ml-2 text-slate-400">
                            {p.amountCents < 0 && 'Refund · '}
                            {PAYMENT_METHOD_LABELS[p.method]}
                            {p.reference ? ` · ${p.reference}` : ''} ·{' '}
                            {(p.receivedAt ?? p.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                          </span>
                          {p.reversedAt && <span className="ml-2 text-xs text-red-400">Reversed</span>}
                        </div>
                        {!p.reversedAt && (
                          <form action={reversePaymentAction}>
                            <input type="hidden" name="paymentId" value={p.id} />
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <ReversePaymentButton />
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isCreditNote && invoice.status !== 'VOID' && balanceCents !== 0 && (
                <RecordPaymentForm
                  key={balanceCents}
                  kind={balanceCents > 0 ? 'payment' : 'refund'}
                  invoiceId={invoice.id}
                  amountCents={Math.abs(balanceCents)}
                  today={today}
                  moneyAccounts={moneyAccounts}
                />
              )}
            </div>
          </>
        ) : (
          <div className="mt-4">
            <InvoiceBuilder
              invoiceId={invoice.id}
              job={invoice.job ? { id: invoice.job.id, number: invoice.job.number } : undefined}
              depositFor={invoice.isDeposit && invoice.quote ? invoice.quote : undefined}
              deductions={deductions.map((l) => ({ description: l.description, unitPriceCents: l.unitPriceCents, taxRateBp: l.taxRateBp ?? 0 }))}
              client={{
                id: invoice.client.id,
                name: displayName(invoice.client),
                properties: invoice.client.properties.map((p) => ({ id: p.id, label: propertyLabel(p) })),
              }}
              tenant={{
                vatRegistered: tenant.vatRegistered,
                defaultTaxRateBp: tenant.defaultTaxRateBp,
                currencyCode: tenant.currencyCode,
                invoiceTerms: tenant.invoiceTerms,
              }}
              catalogItems={catalogItems}
              issue={{
                today,
                defaultDueDate: addDaysToDateStr(today, tenant.defaultPaymentTermsDays),
                isTaxInvoice: tenant.vatRegistered,
              }}
              initial={{
                notes: invoice.notes ?? '',
                propertyId: invoice.propertyId,
                lines: invoice.lines.filter((l) => !l.deductsInvoiceId).map((l) => ({
                  key: l.id,
                  catalogItemId: l.catalogItemId ?? undefined,
                  type: l.type,
                  description: l.description,
                  quantity: l.quantity.toString(),
                  unitCostRands: l.unitCostCents ? (l.unitCostCents / 100).toFixed(2) : '',
                  unitPriceRands: (l.unitPriceCents / 100).toFixed(2),
                  taxable: l.taxRateBp > 0,
                })),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
