import type { PlanTier } from '@prisma/client';
import { requireRole } from '@/lib/auth/session';
import { currentPackage, trialDaysLeft, PLAN_LABEL, PERSON_LIMIT } from '@/lib/plans/plans';

const PLAN_ORDER: PlanTier[] = ['FREE_SOLO', 'TEAM', 'GROWTH'];

const ROWS: { label: string; has: Record<PlanTier, string> }[] = [
  { label: 'Clients, quotes, jobs, schedule, invoicing', has: { FREE_SOLO: '✓', TEAM: '✓', GROWTH: '✓' } },
  { label: 'People who can log in', has: { FREE_SOLO: 'Owner only', TEAM: 'Up to 5', GROWTH: 'Unlimited' } },
  { label: 'Technician app ("My day", on-the-way messages)', has: { FREE_SOLO: '—', TEAM: '✓', GROWTH: '✓' } },
  { label: 'Online payments ("Pay now" on invoices)', has: { FREE_SOLO: '—', TEAM: '✓', GROWTH: '✓' } },
  { label: 'Payment reminders', has: { FREE_SOLO: '—', TEAM: '✓', GROWTH: '✓' } },
];

function personLimitLabel(plan: PlanTier) {
  const limit = PERSON_LIMIT[plan];
  return limit == null ? 'Unlimited people' : `Up to ${limit} ${limit === 1 ? 'person' : 'people'}`;
}

export default async function PackagePage() {
  const { tenant } = await requireRole(['OWNER']);
  const active = currentPackage(tenant);
  const daysLeft = trialDaysLeft(tenant);
  const supportEmail = process.env.SUPPORT_EMAIL;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-1 text-2xl font-bold">Your package</h1>
        <p className="mb-6 text-sm text-slate-400">
          You&apos;re currently on <strong className="text-slate-200">{PLAN_LABEL[active]}</strong>
          {daysLeft != null && ` — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left of your free trial (Growth features included)`}.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="p-4 font-medium">Feature</th>
                {PLAN_ORDER.map((plan) => (
                  <th key={plan} className={`p-4 font-medium ${plan === active ? 'text-amber-400' : ''}`}>
                    {PLAN_LABEL[plan]}
                    {plan === active && <span className="ml-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px]">current</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-slate-800 last:border-0">
                  <td className="p-4 text-slate-300">{row.label}</td>
                  {PLAN_ORDER.map((plan) => (
                    <td key={plan} className="p-4 text-slate-300">
                      {row.has[plan]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="p-4" />
                {PLAN_ORDER.map((plan) => (
                  <td key={plan} className="p-4">
                    {plan === active ? (
                      <span className="text-xs text-slate-500">{personLimitLabel(plan)}</span>
                    ) : supportEmail ? (
                      <a
                        href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Upgrade ${tenant.businessName} to ${PLAN_LABEL[plan]}`)}`}
                        className="inline-block rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                      >
                        Choose {PLAN_LABEL[plan]}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500">Contact ServiceKasi to switch to {PLAN_LABEL[plan]}.</span>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Prices aren&apos;t set yet — we&apos;re still in beta. Nothing you&apos;ve entered is ever deleted when a package changes; only
          creating more of a paid feature is paused.
        </p>
      </div>
    </div>
  );
}
