import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { isoDateDaysFromNow } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { QuoteBuilder } from '@/components/quotes/QuoteBuilder';
import { SendQuoteButton } from '@/components/quotes/SendQuoteButton';
import { convertQuoteToJobAction } from '@/lib/jobs/actions';
import { createDepositInvoiceAction } from '@/lib/invoices/actions';

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

const EDITABLE_STATUSES = new Set(['DRAFT', 'SENT', 'CHANGES_REQUESTED']);

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  const { id } = await params;

  const db = tenantDb(tenant.id);
  const [quote, catalogItems, origin] = await Promise.all([
    db.quote.findUnique({
      where: { id },
      include: {
        client: { include: { properties: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        jobs: {
          include: {
            invoices: { where: { isDeposit: false, kind: { not: 'CREDIT_NOTE' }, status: { in: ['SENT', 'PARTIALLY_PAID', 'PAID'] } }, select: { id: true } },
          },
        },
        invoices: { where: { isDeposit: true, status: { not: 'VOID' } }, select: { id: true, number: true } },
      },
    }),
    db.catalogItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    siteOrigin(),
  ]);
  if (!quote) notFound();

  const isEditable = EDITABLE_STATUSES.has(quote.status);
  const isLocked = !isEditable;
  const publicUrl = `${origin}/q/${quote.publicToken}`;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/quotes" className="text-sm text-amber-400 hover:underline">
          ← Quotes
        </Link>
        <div className="mt-2 mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {quote.number} — {quote.title}
          </h1>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">{quote.status.replace('_', ' ')}</span>
        </div>
        <div className="-mt-4 mb-6 text-sm text-slate-400">
          For{' '}
          <Link href={`/clients/${quote.client.id}`} className="text-slate-200 hover:text-amber-300 hover:underline">
            {displayName(quote.client)}
          </Link>
        </div>

        {quote.status === 'APPROVED' && (
          <div className="mb-6 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <div className="font-medium">
              Approved by {quote.approvedByName}
              {quote.approvedAt && (
                <>
                  ,{' '}
                  {quote.approvedAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: tenant.timezone })} on{' '}
                  {quote.approvedAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tenant.timezone })}
                </>
              )}
            </div>
            <div className="mt-1 text-emerald-200">Approved total: {formatMoney(quote.totalCents, tenant.currencyCode)}</div>
            <form action={convertQuoteToJobAction} className="mt-3">
              <input type="hidden" name="quoteId" value={quote.id} />
              <button type="submit" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
                Convert to job
              </button>
            </form>
          </div>
        )}

        {quote.status === 'CONVERTED' && quote.jobs[0] && (
          <div className="mb-6 rounded-lg bg-purple-500/10 px-4 py-3 text-sm text-purple-300">
            Converted to job{' '}
            <Link href={`/jobs/${quote.jobs[0].id}`} className="font-medium underline hover:text-purple-200">
              {quote.jobs[0].number}
            </Link>
            .
          </div>
        )}

        {(quote.status === 'APPROVED' || quote.status === 'CONVERTED') && quote.depositCents > 0 && (quote.invoices[0] || !quote.jobs[0]?.invoices.length) && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-4 py-3 text-sm">
            <span className="text-slate-300">
              Deposit{quote.depositPercent ? ` (${quote.depositPercent}%)` : ''}: {formatMoney(quote.depositCents, tenant.currencyCode)}
            </span>
            {quote.invoices[0] ? (
              <Link href={`/invoices/${quote.invoices[0].id}`} className="text-amber-400 hover:underline">
                {quote.invoices[0].number ? `Deposit invoice ${quote.invoices[0].number}` : 'Deposit invoice (draft)'}
              </Link>
            ) : (
              <form action={createDepositInvoiceAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700">
                  Invoice the deposit
                </button>
              </form>
            )}
          </div>
        )}

        {quote.status === 'CHANGES_REQUESTED' && quote.clientMessage && (
          <div className="mb-6 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <div className="font-medium">Client requested changes:</div>
            <p className="mt-1 whitespace-pre-wrap text-amber-200">{quote.clientMessage}</p>
          </div>
        )}

        {quote.status === 'DECLINED' && (
          <div className="mb-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <div className="font-medium">Client declined this quote.</div>
            {quote.clientMessage && <p className="mt-1 whitespace-pre-wrap text-red-200">{quote.clientMessage}</p>}
          </div>
        )}

        {isLocked && (
          <p className="mb-6 rounded-lg bg-slate-800/50 px-3 py-2 text-sm text-slate-400">
            This quote is {quote.status.toLowerCase().replace('_', ' ')} and locked. Duplicate it to make changes.
          </p>
        )}

        <div className="mb-6">
          <SendQuoteButton
            quoteId={quote.id}
            status={quote.status}
            publicUrl={publicUrl}
            clientPhone={quote.client.phone}
            quoteNumber={quote.number}
            businessName={tenant.tradingName || tenant.businessName}
            totalCents={quote.totalCents}
            currencyCode={tenant.currencyCode}
          />
        </div>

        {isEditable ? (
          <QuoteBuilder
            quoteId={quote.id}
            quoteNumber={quote.number}
            client={{
              id: quote.client.id,
              name: displayName(quote.client),
              properties: quote.client.properties.map((p) => ({ id: p.id, label: propertyLabel(p) })),
            }}
            tenant={{
              vatRegistered: tenant.vatRegistered,
              defaultTaxRateBp: tenant.defaultTaxRateBp,
              currencyCode: tenant.currencyCode,
              defaultQuoteValidDays: tenant.defaultQuoteValidDays,
              quoteTerms: tenant.quoteTerms,
            }}
            catalogItems={catalogItems}
            defaultValidUntil={isoDateDaysFromNow(tenant.defaultQuoteValidDays)}
            initial={{
              title: quote.title,
              notes: quote.notes ?? '',
              validUntil: quote.validUntil ? quote.validUntil.toISOString().slice(0, 10) : '',
              depositPercent: quote.depositPercent,
              propertyId: quote.propertyId,
              lines: quote.lines.map((l) => ({
                key: l.id,
                catalogItemId: l.catalogItemId ?? undefined,
                type: l.type,
                description: l.description,
                quantity: l.quantity.toString(),
                unitCostRands: l.unitCostCents ? (l.unitCostCents / 100).toFixed(2) : '',
                unitPriceRands: (l.unitPriceCents / 100).toFixed(2),
                taxable: l.taxRateBp > 0,
                optional: l.optional,
              })),
            }}
          />
        ) : (
          <p className="text-sm text-slate-500">Duplicating a locked quote arrives in a later step.</p>
        )}
      </div>
    </div>
  );
}
