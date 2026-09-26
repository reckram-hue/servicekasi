import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { isoDateDaysFromNow } from '@/lib/dates';
import { cancelVisitAction } from '@/lib/jobs/actions';
import { AddVisitForm } from '@/components/jobs/AddVisitForm';

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

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-slate-800 text-slate-400',
  NORMAL: 'bg-slate-800 text-slate-300',
  HIGH: 'bg-amber-500/10 text-amber-300',
  EMERGENCY: 'bg-red-500/10 text-red-300',
};

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  const { id } = await params;

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
          include: { assignments: { include: { membership: { include: { user: true } } } } },
        },
      },
    }),
    db.membership.findMany({ where: { role: 'TECHNICIAN', active: true }, include: { user: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  if (!job) notFound();

  const totalCents = job.lines.reduce((sum, l) => sum + Math.round(Number(l.quantity) * l.unitPriceCents), 0);
  const canSchedule = job.status !== 'CANCELLED' && job.status !== 'COMPLETED';

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

        <div className="mb-6 rounded-xl border border-slate-800 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Visits</h2>
          {job.visits.length === 0 ? (
            <p className="text-sm text-slate-500">No visits scheduled yet.</p>
          ) : (
            <div className="space-y-2">
              {job.visits.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-slate-800 p-3">
                  <div>
                    <div className="text-sm font-medium text-slate-100">
                      {v.startsAt.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tenant.timezone })}
                      {' · '}
                      {v.startsAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: tenant.timezone })}–
                      {v.endsAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: tenant.timezone })}
                    </div>
                    <div className="text-xs text-slate-400">{v.assignments.map((a) => a.membership.user.name).join(', ') || 'Unassigned'}</div>
                    {v.instructions && <div className="mt-1 text-xs text-slate-500">{v.instructions}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VISIT_STATUS_STYLES[v.status] ?? 'bg-slate-800 text-slate-300'}`}>
                      {v.status.replace('_', ' ')}
                    </span>
                    {v.status === 'SCHEDULED' && (
                      <form action={cancelVisitAction}>
                        <input type="hidden" name="visitId" value={v.id} />
                        <input type="hidden" name="jobId" value={job.id} />
                        <button type="submit" className="rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10">
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canSchedule && (
          <AddVisitForm
            jobId={job.id}
            technicians={technicians.map((t) => ({ id: t.id, name: t.user.name }))}
            defaultDate={isoDateDaysFromNow(1)}
          />
        )}
      </div>
    </div>
  );
}
