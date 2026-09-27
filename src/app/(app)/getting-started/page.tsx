import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { getOnboardingChecklist, isChecklistComplete } from '@/lib/onboarding/checklist';
import { showOnboardingChecklistAction } from '@/lib/onboarding/actions';
import { GettingStartedCard } from '@/components/onboarding/GettingStartedCard';

export default async function GettingStartedPage() {
  const { tenant, user } = await requireRole(['OWNER', 'ADMIN']);
  const db = tenantDb(tenant.id);
  const items = await getOnboardingChecklist(db, tenant, user);
  const complete = isChecklistComplete(items);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-bold">Getting started</h1>
        <p className="mb-6 text-sm text-slate-400">
          {complete
            ? "You've done everything on this list. Nice work — the checklist won't show on your dashboard unless something changes."
            : "A short list of what's worth setting up. Nothing here is required to use ServiceKasi — do it in whatever order suits you."}
        </p>
        {tenant.onboardingHiddenAt && !complete && (
          <form action={showOnboardingChecklistAction} className="mb-4">
            <button type="submit" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
              Show this on my dashboard again
            </button>
          </form>
        )}
        <GettingStartedCard items={items} />
      </div>
    </div>
  );
}
