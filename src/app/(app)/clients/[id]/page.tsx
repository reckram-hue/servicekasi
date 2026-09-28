import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { clientTimeline, upcomingVisits, type TimelineEvent } from '@/lib/clients/timeline';
import { invoiceBalanceCents } from '@/lib/invoices/payments';
import { formatMoney } from '@/lib/money';
import { formatDateStr, localDateStr, localTimeStr } from '@/lib/dates';
import { normalizeSaPhone } from '@/lib/southAfrica';
import { EditClientButton } from '@/components/clients/EditClientButton';

const DOT: Record<NonNullable<TimelineEvent['tone']> | 'plain', string> = {
  good: 'bg-emerald-400',
  bad: 'bg-red-400',
  plain: 'bg-slate-500',
};

const KIND_LABEL: Record<TimelineEvent['kind'], string> = {
  request: 'Request',
  quote: 'Quote',
  job: 'Job',
  visit: 'Visit',
  invoice: 'Invoice',
  payment: 'Payment',
  message: 'Message',
};

const ACTION = 'rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700';

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  const { id } = await params;
  const tz = tenant.timezone;

  const db = tenantDb(tenant.id);
  const client = await db.client.findUnique({ where: { id }, include: { properties: true } });
  if (!client) notFound();

  const [{ events, truncated }, upcoming, jobCount, invoices] = await Promise.all([
    clientTimeline(db, id, tenant.currencyCode),
    upcomingVisits(db, id),
    db.job.count({ where: { clientId: id } }),
    db.invoice.findMany({
      where: { clientId: id, kind: { not: 'CREDIT_NOTE' }, status: { in: ['SENT', 'PARTIALLY_PAID', 'PAID'] } },
      select: { status: true, totalCents: true, paidCents: true, creditedCents: true },
    }),
  ]);

  const paidCents = invoices.reduce((sum, i) => sum + i.paidCents, 0);
  const owingCents = invoices
    .filter((i) => i.status !== 'PAID')
    .reduce((sum, i) => sum + Math.max(0, invoiceBalanceCents(i)), 0);
  const money = (cents: number) => formatMoney(cents, tenant.currencyCode);

  const name = [client.firstName, client.lastName].filter(Boolean).join(' ');
  const whatsapp = client.phone ? `https://wa.me/${normalizeSaPhone(client.phone).replace('+', '')}` : null;
  const DAY = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  const when = (d: Date, dateOnly = false) =>
    dateOnly ? formatDateStr(d.toISOString().slice(0, 10), DAY) : `${formatDateStr(localDateStr(d, tz), DAY)}, ${localTimeStr(d, tz)}`;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/clients" className="text-sm text-amber-400 hover:underline">
          ← Clients
        </Link>

        <div className={`mt-2 mb-6 flex flex-wrap items-start justify-between gap-3 ${client.archived ? 'opacity-70' : ''}`}>
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            {client.companyName && <div className="text-sm text-slate-400">{client.companyName}</div>}
            <div className="mt-2 flex flex-wrap gap-2">
              {client.archived && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">ARCHIVED</span>}
              {client.marketingOptOutAt && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">NO PROMOTIONS</span>
              )}
            </div>
          </div>
          <EditClientButton client={client} />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <Link href={`/quotes/new?client=${client.id}`} className={ACTION}>
            New quote
          </Link>
          <Link href={`/jobs/new?client=${client.id}`} className={ACTION}>
            New job
          </Link>
          <Link href={`/invoices/new?client=${client.id}`} className={ACTION}>
            New invoice
          </Link>
          {client.phone && (
            <a href={`tel:${client.phone}`} className={ACTION}>
              Call
            </a>
          )}
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noreferrer" className={ACTION}>
              WhatsApp
            </a>
          )}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="flex items-baseline justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 sm:block sm:p-4">
            <div className="text-xs text-slate-500">Jobs</div>
            <div className="text-xl font-bold tabular-nums sm:mt-1">{jobCount}</div>
          </div>
          <div className="flex items-baseline justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 sm:block sm:p-4">
            <div className="text-xs text-slate-500">Paid so far</div>
            <div className="font-mono text-xl font-bold tabular-nums sm:mt-1">{money(paidCents)}</div>
          </div>
          <div className="flex items-baseline justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 sm:block sm:p-4">
            <div className="text-xs text-slate-500">Owing now</div>
            <div className={`font-mono text-xl font-bold tabular-nums sm:mt-1 ${owingCents > 0 ? 'text-red-400' : ''}`}>{money(owingCents)}</div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Contact</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-24 text-slate-500">Phone</dt>
              <dd>{client.phone ?? <span className="text-slate-500">Not given</span>}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 text-slate-500">Email</dt>
              <dd>{client.email ?? <span className="text-slate-500">Not given</span>}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 text-slate-500">Language</dt>
              <dd>{client.preferredLanguage}</dd>
            </div>
          </dl>
          {client.properties.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
              {client.properties.map((p) => (
                <div key={p.id} className="text-sm">
                  <div>{[p.unitOrComplex, p.street, p.suburb, p.city].filter(Boolean).join(', ')}</div>
                  {p.accessNotes && <div className="mt-0.5 text-xs text-slate-500">Access: {p.accessNotes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {client.notes && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-300">{client.notes}</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Coming up</h2>
            <ul className="space-y-2 text-sm">
              {upcoming.map((v) => (
                <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/jobs/${v.job.id}`} className="hover:text-amber-300 hover:underline">
                    {v.job.number}: {v.job.title}
                  </Link>
                  <span className="text-xs text-slate-400">{when(v.startsAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">History</h2>
          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Nothing yet. Requests, quotes, jobs, invoices and payments for this client will show up here as they happen.
            </p>
          ) : (
            <ol className="space-y-4">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[e.tone ?? 'plain']}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <div className="text-sm text-slate-200">
                        {e.href ? (
                          <Link href={e.href} className="hover:text-amber-300 hover:underline">
                            {e.title}
                          </Link>
                        ) : (
                          e.title
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {KIND_LABEL[e.kind]} · {when(e.at, e.dateOnly)}
                      </div>
                    </div>
                    {e.detail && <div className="mt-0.5 text-xs text-slate-400">{e.detail}</div>}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {truncated && <p className="mt-4 text-center text-xs text-slate-500">Showing the latest {events.length} events.</p>}
        </div>
      </div>
    </div>
  );
}
