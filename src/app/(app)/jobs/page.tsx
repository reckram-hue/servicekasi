import Link from 'next/link';
import { JobStatus } from '@prisma/client';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'REQUIRES_INVOICING', label: 'Requires invoicing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function displayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-800 text-slate-300',
  SCHEDULED: 'bg-blue-500/10 text-blue-300',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-300',
  ON_HOLD: 'bg-slate-700 text-slate-300',
  REQUIRES_INVOICING: 'bg-purple-500/10 text-purple-300',
  COMPLETED: 'bg-emerald-500/10 text-emerald-300',
  CANCELLED: 'bg-red-500/10 text-red-300',
};

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { tenant } = await requireRole();
  const { status } = await searchParams;
  const statusFilter = status && status in JobStatus ? (status as JobStatus) : undefined;

  const db = tenantDb(tenant.id);
  const [jobs, clients] = await Promise.all([
    db.job.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      include: { client: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.client.findMany({ where: { archived: false }, orderBy: { firstName: 'asc' }, take: 500 }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold">Jobs — {tenant.businessName}</h1>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tab.value ? `/jobs?status=${tab.value}` : '/jobs'}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  (status ?? '') === tab.value ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {clients.length > 0 && (
            <form action="/jobs/new" method="GET" className="flex items-center gap-2">
              <select
                name="client"
                required
                defaultValue=""
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
              >
                <option value="" disabled>
                  Choose a client…
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {displayName(c)}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
                + New job
              </button>
            </form>
          )}
        </div>

        {jobs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500">
            {status ? 'No jobs with this status.' : 'No jobs yet. Pick a client above to create the first one.'}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            {jobs.map((j) => (
              <Link
                key={j.id}
                href={`/jobs/${j.id}`}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4 last:border-0 hover:bg-slate-800/50"
              >
                <div>
                  <div className="font-medium text-slate-100">
                    {j.number} — {j.title}
                    {j.recurrenceRule && <span className="ml-2 text-xs font-normal text-slate-400">↻ repeats</span>}
                  </div>
                  <div className="text-xs text-slate-400">{displayName(j.client)}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[j.status] ?? 'bg-slate-800 text-slate-300'}`}>
                  {j.status.replace('_', ' ')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
