import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { trialHasLapsed, PLAN_LABEL } from '@/lib/plans/plans';
import { trialEndSummary } from '@/lib/plans/trialEnd';
import { acknowledgeTrialEndAction } from '@/lib/plans/actions';
import { AuthCard, SubmitButton } from '@/components/auth/ui';

/** Shown once, the first time the owner is seen after the 30-day trial has run out — the "you'll miss this" moment. */
export default async function TrialEndedPage() {
  const { tenant } = await requireRole(['OWNER']);
  if (!trialHasLapsed(tenant) || tenant.trialEndScreenShownAt) redirect('/');

  const summary = await trialEndSummary(tenant.id);
  const usedSomething = summary.technicianCount > 0 || summary.onlinePaymentsEnabled;

  return (
    <AuthCard title="Your free trial has ended" subtitle="Nothing you've entered is deleted — quotes, jobs and invoices are all still here.">
      {usedSomething && (
        <div className="mb-5 rounded-xl border border-amber-800 bg-amber-500/10 p-4 text-sm text-amber-200">
          <p className="mb-2 font-semibold">During your trial you used:</p>
          <ul className="list-disc space-y-1 pl-5">
            {summary.technicianCount > 0 && (
              <li>
                {summary.technicianCount} technician{summary.technicianCount === 1 ? '' : 's'} added to your team
              </li>
            )}
            {summary.onlinePaymentsEnabled && (
              <li>
                Online payments{summary.onlinePaymentsReceived > 0 ? ` — ${summary.onlinePaymentsReceived} received so far` : ''}
              </li>
            )}
          </ul>
          <p className="mt-2">These are now paused on the Free Solo package. Upgrade to keep them switched on.</p>
        </div>
      )}
      <p className="mb-5 text-sm text-slate-300">
        Your business is now on <strong>{PLAN_LABEL.FREE_SOLO}</strong>. You can keep using it for free, or choose a paid package to get
        your team and online payments back.
      </p>
      <form action={acknowledgeTrialEndAction} className="space-y-3">
        <SubmitButton pending={false}>Continue on Free Solo</SubmitButton>
      </form>
    </AuthCard>
  );
}
