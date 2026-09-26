import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { isoDateDaysFromNow } from '@/lib/dates';
import { QuoteBuilder } from '@/components/quotes/QuoteBuilder';

function displayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

function propertyLabel(p: { street: string; suburb: string | null; city: string }) {
  return [p.street, p.suburb, p.city].filter(Boolean).join(', ');
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  const { id } = await params;

  const db = tenantDb(tenant.id);
  const [quote, catalogItems] = await Promise.all([
    db.quote.findUnique({
      where: { id },
      include: { client: { include: { properties: true } }, lines: { orderBy: { sortOrder: 'asc' } } },
    }),
    db.catalogItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);
  if (!quote) notFound();

  const isDraft = quote.status === 'DRAFT';

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
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">{quote.status}</span>
        </div>

        {!isDraft && (
          <p className="mb-6 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            This quote is {quote.status.toLowerCase().replace('_', ' ')} and can no longer be edited here.
          </p>
        )}

        {isDraft ? (
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
          <p className="text-slate-400">Sending, client approval and duplicating a locked quote arrive in the next step.</p>
        )}
      </div>
    </div>
  );
}
