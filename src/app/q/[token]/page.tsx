import { notFound } from 'next/navigation';
import { getPublicQuoteByToken } from '@/lib/quotes/publicQuery';
import { formatMoney } from '@/lib/money';
import { isValidUntilPassed } from '@/lib/dates';
import { PublicQuoteView } from '@/components/quotes/PublicQuoteView';

function clientDisplayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || 'there';
}

function propertyLabel(p: { street: string; suburb: string | null; city: string }) {
  return [p.street, p.suburb, p.city].filter(Boolean).join(', ');
}

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getPublicQuoteByToken(token);
  if (!quote) notFound();

  const businessName = quote.tenant.tradingName || quote.tenant.businessName;
  const clientName = clientDisplayName(quote.client);
  const isExpired = isValidUntilPassed(quote.validUntil);
  const timeZone = quote.tenant.timezone;
  const isRespondable = (quote.status === 'SENT' || quote.status === 'CHANGES_REQUESTED') && !isExpired;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          {quote.tenant.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={quote.tenant.logoUrl} alt={businessName} className="mx-auto mb-3 h-12 w-auto" />
          )}
          <div className="text-xl font-bold text-amber-400">{businessName}</div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Quote {quote.number}</div>
          <h1 className="mt-1 text-lg font-semibold text-slate-100">{quote.title}</h1>
          <div className="mt-1 text-sm text-slate-400">
            Hi {clientName}
            {quote.property && <> — for {propertyLabel(quote.property)}</>}
          </div>
          {quote.validUntil && !isExpired && quote.status !== 'APPROVED' && quote.status !== 'CONVERTED' && (
            <div className="mt-2 text-xs text-slate-500">
              Valid until{' '}
              {quote.validUntil.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </div>
          )}
        </div>

        {quote.status === 'DRAFT' && (
          <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-400">
            This quote isn&apos;t ready to view yet. Please contact {businessName} if you were expecting one.
          </p>
        )}

        {quote.status !== 'DRAFT' && isExpired && (quote.status === 'SENT' || quote.status === 'CHANGES_REQUESTED') && (
          <div className="rounded-xl border border-amber-800 bg-amber-500/10 p-5 text-center">
            <p className="font-semibold text-amber-300">This quote has expired.</p>
            <p className="mt-1 text-sm text-amber-200">
              Please contact {businessName} for an updated quote
              {quote.tenant.phone && <> on {quote.tenant.phone}</>}
              {quote.tenant.email && <> or {quote.tenant.email}</>}.
            </p>
          </div>
        )}

        {isRespondable && (
          <PublicQuoteView
            token={quote.publicToken}
            version={quote.updatedAt.toISOString()}
            clientName={clientName}
            currencyCode={quote.tenant.currencyCode}
            depositPercent={quote.depositPercent}
            lines={quote.lines.map((l) => ({
              id: l.id,
              description: l.description,
              quantity: Number(l.quantity),
              unitPriceCents: l.unitPriceCents,
              taxRateBp: l.taxRateBp,
              optional: l.optional,
              selected: l.selected,
            }))}
          />
        )}

        {(quote.status === 'APPROVED' || quote.status === 'CONVERTED') && (
          <div className="rounded-xl border border-emerald-800 bg-emerald-500/10 p-5 text-center">
            <p className="font-semibold text-emerald-300">
              Approved by {quote.approvedByName}
              {quote.approvedAt && (
                <>
                  {' '}
                  on{' '}
                  {quote.approvedAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone })} at{' '}
                  {quote.approvedAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone })}
                </>
              )}
            </p>
            <p className="mt-2 text-xl font-bold text-slate-100">{formatMoney(quote.totalCents, quote.tenant.currencyCode)}</p>
          </div>
        )}

        {quote.status === 'DECLINED' && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-center text-slate-400">
            <p>You declined this quote.</p>
          </div>
        )}

        {quote.notes && (
          <div className="mt-6 rounded-xl border border-slate-800 p-4 text-sm text-slate-400">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Terms</div>
            <p className="whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
