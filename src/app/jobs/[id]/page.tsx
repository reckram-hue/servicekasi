import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { formatDateStr, isoDateDaysFromNow, localDateStr, localTimeStr, todayDateStr, zonedDateTime } from '@/lib/dates';
import { describeRule, patternOf } from '@/lib/recurrence';
import { publicHolidayName } from '@/lib/holidays';
import { cancelVisitAction, deleteAttachmentAction, stopRecurrenceAction } from '@/lib/jobs/actions';
import { recurrenceEndsStr, topUpRecurringVisits } from '@/lib/jobs/recurring';
import { createInvoiceFromJobAction } from '@/lib/invoices/actions';
import { invoiceBadge } from '@/lib/invoices/status';
import { AddVisitForm } from '@/components/jobs/AddVisitForm';
import { RecurrenceForm } from '@/components/jobs/RecurrenceForm';

function displayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

function propertyLabel(p: { street: string; suburb: string | null; city: string }) {
  return [p.street, p.suburb, p.city].filter(Boolean).join(', ');
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-800 text-slate-300',
  SCHEDULED: 'bg-blue-500/10 text-blue-300',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-300',
  REQUIRES_INVOICING: 'bg-purple-500/10 text-purple-300',
  COMPLETED: 'bg-emerald-500/10 text-emerald-300',
  CANCELLED: 'bg-red-500/10 text-red-300',
};

const VISIT_STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/10 text-blue-300',
  EN_ROUTE: 'bg-amber-500/10 text-amber-300',
  ON_SITE: 'bg-amber-500/10 text-amber-300',
  COMPLETED: 'bg-emerald-500/10 text-emerald-300',
  CANCELLED: 'bg-red-500/10 text-red-300',
  NO_ACCESS: 'bg-red-500/10 text-red-300',
};

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-slate-800 text-slate-400',
  NORMAL: 'bg-slate-800 text-slate-300',
  HIGH: 'bg-amber-500/10 text-amber-300',
  EMERGENCY: 'bg-red-500/10 text-red-300',
};

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  const { id } = await params;
  const tz = tenant.timezone;

  await topUpRecurringVisits(tenant.id, tz);

  const db = tenantDb(tenant.id);
  const [job, technicians] = await Promise.all([
    db.job.findUnique({
      where: { id },
      include: {
        client: true,
        property: true,
        quote: true,
        lines: { orderBy: { sortOrder: 'asc' } },
        visits: {
          orderBy: { startsAt: 'asc' },
          include: {
            assignments: { include: { membership: { include: { user: true } } } },
            attachments: { orderBy: { createdAt: 'asc' } },
          },
        },
        invoices: { orderBy: { createdAt: 'desc' } },
      },
    }),
    db.membership.findMany({ where: { role: 'TECHNICIAN', active: true }, include: { user: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  if (!job) notFound();

  const today = todayDateStr(tz);
  const startOfToday = zonedDateTime(today, '00:00');
  const techOptions = technicians.map((t) => ({ id: t.id, name: t.user.name }));
  const totalCents = job.lines.reduce((sum, l) => sum + Math.round(Number(l.quantity) * l.unitPriceCents), 0);
  const isOpen = job.status !== 'CANCELLED' && job.status !== 'COMPLETED';

  const upcoming = job.visits.filter((v) => v.endsAt >= startOfToday);
  const past = job.visits.filter((v) => v.endsAt < startOfToday).reverse();

  const recurrenceEnds = recurrenceEndsStr(job);
  const recurrenceStopped = !!recurrenceEnds && recurrenceEnds <= today;
  const recurrenceTechNames = job.recurrenceTechnicianIds
    .map((tid) => technicians.find((t) => t.id === tid)?.user.name)
    .filter(Boolean)
    .join(', ');

  const jobId = job.id;
  type VisitItem = (typeof upcoming)[number];

  const VisitRow = ({ v }: { v: VisitItem }) => {
    const date = localDateStr(v.startsAt, tz);
    const holiday = v.status !== 'CANCELLED' ? publicHolidayName(tenant.countryCode, date) : null;
    return (
      <div className="rounded-lg border border-slate-800 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-slate-100">
              {formatDateStr(date)} · {localTimeStr(v.startsAt, tz)}–{localTimeStr(v.endsAt, tz)}
              {v.occurrenceDate && <span className="ml-1 text-slate-500" title="Part of a repeating schedule">↻</span>}
            </div>
            <div className="text-xs text-slate-400">{v.assignments.map((a) => a.membership.user.name).join(', ') || 'Unassigned'}</div>
            {holiday && <div className="mt-1 text-xs text-amber-300">⚠ Public holiday: {holiday}</div>}
            {v.instructions && <div className="mt-1 text-xs text-slate-500">{v.instructions}</div>}
            {v.completionNotes && <div className="mt-1 text-xs text-slate-400">Technician: {v.completionNotes}</div>}
            {v.attachments.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {v.attachments.map((a) => (
                  <div key={a.id} className="group relative aspect-square overflow-hidden rounded-md border border-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.kind} className="h-full w-full object-cover" />
                    <form action={deleteAttachmentAction} className="absolute right-0.5 top-0.5">
                      <input type="hidden" name="attachmentId" value={a.id} />
                      <button
                        type="submit"
                        className="rounded bg-red-600/90 px-1 text-[10px] text-white opacity-0 group-hover:opacity-100"
                        aria-label="Delete photo"
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
            {v.signatureUrl && (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.signatureUrl} alt="Client signature" className="h-10 rounded border border-slate-800 bg-white" />
                <span className="text-xs text-slate-500">
                  Signed by {v.signedByName}
                  {v.signedAt && ` · ${formatDateStr(localDateStr(v.signedAt, tz))}`}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VISIT_STATUS_STYLES[v.status] ?? 'bg-slate-800 text-slate-300'}`}>
              {v.occurrenceDate && v.status === 'CANCELLED' ? 'SKIPPED' : v.status.replace('_', ' ')}
            </span>
            {v.status === 'SCHEDULED' && (
              <form action={cancelVisitAction}>
                <input type="hidden" name="visitId" value={v.id} />
                <input type="hidden" name="jobId" value={jobId} />
                <button type="submit" className="rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10">
                  {v.occurrenceDate ? 'Skip' : 'Cancel'}
                </button>
              </form>
            )}
          </div>
        </div>
        {v.status === 'SCHEDULED' && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-amber-400">Edit this visit only</summary>
            <AddVisitForm
              jobId={jobId}
              technicians={techOptions}
              defaultDate={date}
              visit={{
                id: v.id,
                date,
                startTime: localTimeStr(v.startsAt, tz),
                endTime: localTimeStr(v.endsAt, tz),
                technicianIds: v.assignments.map((a) => a.membershipId),
                instructions: v.instructions ?? '',
              }}
            />
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/jobs" className="text-sm text-amber-400 hover:underline">
          ← Jobs
        </Link>
        <div className="mt-2 mb-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">
            {job.number} — {job.title}
          </h1>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${PRIORITY_STYLES[job.priority]}`}>{job.priority}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[job.status] ?? 'bg-slate-800 text-slate-300'}`}>
              {job.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {job.quote && (
          <p className="mb-6 text-sm text-slate-500">
            Converted from quote{' '}
            <Link href={`/quotes/${job.quote.id}`} className="text-amber-400 hover:underline">
              {job.quote.number}
            </Link>
          </p>
        )}

        <div className="mb-6 rounded-xl border border-slate-800 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Client</div>
          <div className="font-medium text-slate-100">{displayName(job.client)}</div>
          {job.property && <div className="mt-1 text-sm text-slate-400">{propertyLabel(job.property)}</div>}
          {job.description && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{job.description}</p>}
        </div>

        {job.lines.length > 0 && (
          <div className="mb-6 rounded-xl border border-slate-800 p-4">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Lines</h2>
            <div className="space-y-2 text-sm">
              {job.lines.map((l) => (
                <div key={l.id} className="flex justify-between text-slate-300">
                  <span>
                    {l.description} × {l.quantity.toString()}
                  </span>
                  <span className="text-slate-100">{formatMoney(Math.round(Number(l.quantity) * l.unitPriceCents), tenant.currencyCode)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-800 pt-2 font-semibold text-slate-100">
                <span>Total</span>
                <span>{formatMoney(totalCents, tenant.currencyCode)}</span>
              </div>
            </div>
          </div>
        )}

        <div
          className={`mb-6 rounded-xl border p-4 ${
            job.status === 'REQUIRES_INVOICING' ? 'border-purple-800 bg-purple-500/5' : 'border-slate-800'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Invoices</h2>
            {isOpen && (
              <form action={createInvoiceFromJobAction}>
                <input type="hidden" name="jobId" value={job.id} />
                <button type="submit" className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400">
                  Create invoice
                </button>
              </form>
            )}
          </div>
          {job.invoices.length === 0 ? (
            <p className="text-sm text-slate-500">Not invoiced yet.</p>
          ) : (
            <div className="space-y-2">
              {job.invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 p-3 text-sm hover:bg-slate-800/50"
                >
                  <span className="text-slate-100">{inv.number ?? 'Draft'}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-slate-400">{formatMoney(inv.totalCents, tenant.currencyCode)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${invoiceBadge(inv).style}`}>{invoiceBadge(inv).label}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {job.recurrenceRule ? (
          <div className="mb-6 rounded-xl border border-slate-800 p-4">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">↻ Repeating</h2>
            <p className="text-slate-100">
              {describeRule(job.recurrenceRule)}, {job.recurrenceStartTime}–{job.recurrenceEndTime}
            </p>
            <p className="text-sm text-slate-400">
              {recurrenceTechNames || 'No technician'} ·{' '}
              {recurrenceStopped
                ? `ended ${formatDateStr(recurrenceEnds!, LONG_DATE)}`
                : `from ${job.recurrenceStart ? formatDateStr(job.recurrenceStart, LONG_DATE) : '—'}${recurrenceEnds ? ` until ${formatDateStr(recurrenceEnds, LONG_DATE)}` : ''}`}
            </p>
            {recurrenceStopped && <p className="mt-2 text-sm text-amber-300">This contract has ended — no more visits will be added.</p>}

            {isOpen && (
              <>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-amber-400">
                    {recurrenceStopped ? 'Restart or change the schedule' : 'Change all future visits'}
                  </summary>
                  <div className="mt-3">
                    <RecurrenceForm
                      jobId={job.id}
                      technicians={techOptions}
                      today={today}
                      countryCode={tenant.countryCode}
                      current={{
                        pattern: patternOf(job.recurrenceRule) ?? 'WEEKLY',
                        firstDate: job.recurrenceStart ?? today,
                        startTime: job.recurrenceStartTime ?? '',
                        endTime: job.recurrenceEndTime ?? '',
                        endsOn: recurrenceStopped ? '' : (recurrenceEnds ?? ''),
                        technicianIds: job.recurrenceTechnicianIds,
                        instructions: job.recurrenceInstructions ?? '',
                      }}
                    />
                  </div>
                </details>
                {!recurrenceStopped && (
                  <form action={stopRecurrenceAction} className="mt-3">
                    <input type="hidden" name="jobId" value={job.id} />
                    <button type="submit" className="rounded-lg border border-red-900 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20">
                      Stop contract after today
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        ) : (
          isOpen && (
            <details className="mb-6 rounded-xl border border-slate-800 p-4">
              <summary className="cursor-pointer text-sm font-medium text-amber-400">↻ Repeat this job (weekly, fortnightly or monthly)</summary>
              <div className="mt-3">
                <RecurrenceForm jobId={job.id} technicians={techOptions} today={today} countryCode={tenant.countryCode} />
              </div>
            </details>
          )
        )}

        <div className="mb-6 rounded-xl border border-slate-800 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Visits</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming visits.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((v) => (
                <VisitRow key={v.id} v={v} />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-slate-400">Past visits ({past.length})</summary>
              <div className="mt-2 space-y-2">
                {past.map((v) => (
                  <VisitRow key={v.id} v={v} />
                ))}
              </div>
            </details>
          )}
        </div>

        {isOpen && <AddVisitForm jobId={job.id} technicians={techOptions} defaultDate={isoDateDaysFromNow(1)} />}
      </div>
    </div>
  );
}
