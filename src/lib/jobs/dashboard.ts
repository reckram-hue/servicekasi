import 'server-only';
import type { TenantDb } from '@/lib/db';

function clientLabel(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

function locationLabel(p: { suburb: string | null; city: string } | null) {
  return p ? [p.suburb, p.city].filter(Boolean).join(', ') : null;
}

export type DashboardJob = {
  id: string;
  number: string;
  title: string;
  category: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';
  status: 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'REQUIRES_INVOICING' | 'COMPLETED';
  clientName: string;
  locationLabel: string | null;
  nextVisit: { startsAt: Date; endsAt: Date; technicianNames: string[] } | null;
};

/** Every open job (not cancelled) for the dispatch board and table view, with the info each card needs already computed. */
export async function dashboardJobs(db: TenantDb): Promise<DashboardJob[]> {
  const jobs = await db.job.findMany({
    where: { status: { not: 'CANCELLED' } },
    include: {
      client: true,
      property: true,
      visits: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { startsAt: 'asc' },
        take: 20,
        include: { assignments: { include: { membership: { include: { user: true } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  const now = Date.now();
  return jobs.map((job) => {
    const upcoming = job.visits.find((v) => v.startsAt.getTime() >= now);
    const chosen = upcoming ?? job.visits[job.visits.length - 1];
    return {
      id: job.id,
      number: job.number,
      title: job.title,
      category: job.category,
      priority: job.priority,
      status: job.status as DashboardJob['status'],
      clientName: clientLabel(job.client),
      locationLabel: locationLabel(job.property),
      nextVisit: chosen
        ? { startsAt: chosen.startsAt, endsAt: chosen.endsAt, technicianNames: chosen.assignments.map((a) => a.membership.user.name.split(' ')[0]) }
        : null,
    };
  });
}

/** Money actually collected so far (net of refunds) across every issued invoice, plus the VAT share of it. */
export async function collectedRevenue(db: TenantDb): Promise<{ collectedCents: number; collectedVatCents: number }> {
  const invoices = await db.invoice.findMany({
    where: { kind: { not: 'CREDIT_NOTE' }, status: { not: 'DRAFT' } },
    select: { totalCents: true, taxCents: true, paidCents: true },
  });
  let collectedCents = 0;
  let collectedVatCents = 0;
  for (const inv of invoices) {
    collectedCents += inv.paidCents;
    if (inv.totalCents > 0) collectedVatCents += Math.round((inv.taxCents * inv.paidCents) / inv.totalCents);
  }
  return { collectedCents, collectedVatCents };
}
