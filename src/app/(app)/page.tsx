import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/session';
import { logoutAction } from '@/lib/auth/actions';
import { tenantDb } from '@/lib/db';
import { moneyOwedSummary } from '@/lib/invoices/overdue';
import { dashboardJobs, collectedRevenue } from '@/lib/jobs/dashboard';
import { getOnboardingChecklist, isChecklistComplete } from '@/lib/onboarding/checklist';
import { AppShell } from '@/components/AppShell';
import { TechnicianDay } from '@/components/technician/TechnicianDay';

export default async function Home() {
  const { user, membership, tenant } = await requireAuth();

  // Owners are asked to set up the authenticator app first; they may choose "Skip for now".
  if (membership.role === 'OWNER' && !user.totpEnabled && !user.totpSkippedAt) redirect('/settings/security');

  if (membership.role === 'TECHNICIAN') {
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
        <div className="mx-auto max-w-lg">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Hi {user.name}</h1>
            <form action={logoutAction}>
              <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm">Log out</button>
            </form>
          </div>
          <TechnicianDay tenant={{ id: tenant.id, timezone: tenant.timezone }} membershipId={membership.id} />
        </div>
      </div>
    );
  }

  const db = tenantDb(tenant.id);
  const [moneyOwed, revenue, jobs, technicianCount, checklistItems] = await Promise.all([
    moneyOwedSummary(db),
    collectedRevenue(db),
    dashboardJobs(db),
    db.membership.count({ where: { OR: [{ role: 'TECHNICIAN' }, { doesFieldwork: true }], active: true } }),
    membership.role === 'OWNER' || membership.role === 'ADMIN' ? getOnboardingChecklist(db, tenant, user) : null,
  ]);
  const activeDispatches = jobs.filter((j) => j.status === 'SCHEDULED' || j.status === 'IN_PROGRESS').length;
  const unassignedCount = jobs.filter(
    (j) => (j.status === 'DRAFT' || j.status === 'SCHEDULED') && (j.nextVisit === null || j.nextVisit.technicianNames.length === 0)
  ).length;
  const showChecklist = !!checklistItems && !tenant.onboardingHiddenAt && !isChecklistComplete(checklistItems);

  return (
    <AppShell
      moneyOwed={{ ...moneyOwed, currencyCode: tenant.currencyCode }}
      checklist={showChecklist ? checklistItems! : undefined}
      jobs={jobs}
      technicianCount={technicianCount}
      currencyCode={tenant.currencyCode}
      finance={{ ...revenue, outstandingCents: moneyOwed.outstandingCents }}
      activeDispatches={activeDispatches}
      unassignedCount={unassignedCount}
    />
  );
}
