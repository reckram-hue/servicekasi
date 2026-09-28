import { requirePlatformAdmin } from '@/lib/auth/session';
import { listTenantsForAdmin } from '@/lib/admin/queries';
import { setTenantPlanAction, toggleTenantBetaAction, extendTenantTrialAction } from '@/lib/admin/actions';

const PLAN_LABEL: Record<string, string> = { FREE_SOLO: 'Free Solo', TEAM: 'Team', GROWTH: 'Growth' };
const INPUT = 'rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:border-amber-400 focus:outline-none';

function daysAgo(date: Date | null): string {
  if (!date) return 'Never logged in';
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Active today';
  if (days === 1) return 'Active yesterday';
  return `Last active ${days} days ago`;
}

/** ServiceKasi staff only — every business on the platform, with the levers currently only reachable via `npm run set-package`. */
export default async function AdminTenantsPage() {
  await requirePlatformAdmin();
  const tenants = await listTenantsForAdmin();

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-2xl font-bold">All businesses</h1>
        <p className="mb-6 text-sm text-slate-500">Every tenant on ServiceKasi — you&apos;re seeing this because your account is a platform admin.</p>

        <div className="space-y-3">
          {tenants.map((t) => {
            const inactive = t.clientCount === 0 && t.jobCount === 0;
            return (
              <div key={t.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-medium text-slate-100">
                      {t.businessName}
                      {t.isBeta && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">BETA</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {PLAN_LABEL[t.plan] ?? t.plan} · {t.subscriptionStatus}
                      {t.trialEndsAt && ` · trial ends ${t.trialEndsAt.toLocaleDateString('en-ZA')}`}
                    </div>
                    {t.ownerEmail && (
                      <div className="mt-0.5 text-xs text-slate-500">
                        {t.ownerName} ·{' '}
                        <a href={`mailto:${t.ownerEmail}`} className="text-amber-400 hover:underline">
                          {t.ownerEmail}
                        </a>
                      </div>
                    )}
                  </div>
                  <div className={`text-right text-xs ${inactive ? 'text-amber-400' : 'text-slate-500'}`}>
                    <div>{t.clientCount} clients · {t.jobCount} jobs</div>
                    <div>{daysAgo(t.lastLoginAt)}</div>
                    {inactive && <div className="font-medium">Hasn&apos;t started setting up yet</div>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <form action={setTenantPlanAction} className="flex items-center gap-1">
                    <input type="hidden" name="tenantId" value={t.id} />
                    <select name="plan" defaultValue={t.plan} className={INPUT}>
                      <option value="FREE_SOLO">Free Solo</option>
                      <option value="TEAM">Team</option>
                      <option value="GROWTH">Growth</option>
                    </select>
                    <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700">
                      Set plan
                    </button>
                  </form>

                  <form action={toggleTenantBetaAction}>
                    <input type="hidden" name="tenantId" value={t.id} />
                    <button
                      type="submit"
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        t.isBeta ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      }`}
                    >
                      {t.isBeta ? 'Remove beta' : 'Mark as beta'}
                    </button>
                  </form>

                  <form action={extendTenantTrialAction} className="flex items-center gap-1">
                    <input type="hidden" name="tenantId" value={t.id} />
                    <input type="number" name="days" defaultValue={30} min={1} max={365} className={`${INPUT} w-16`} />
                    <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700">
                      Extend trial (days)
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
