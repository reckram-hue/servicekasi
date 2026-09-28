import { requireAuth } from '@/lib/auth/session';
import { logoutAction } from '@/lib/auth/actions';
import { tenantDb } from '@/lib/db';
import { getOnboardingChecklist, isChecklistComplete } from '@/lib/onboarding/checklist';
import { trialDaysLeft } from '@/lib/plans/plans';
import { AppChrome } from '@/components/AppChrome';

const TRIAL_BANNER_FROM_DAY = 10; // shown for the last 10 days of the 30-day trial

/**
 * Every signed-in page (dashboard, clients, jobs, invoices, settings…) shares
 * this layout, so the sidebar and the signed-in person's details are only
 * fetched and wired up once. Technicians get their own stripped-down mobile
 * view instead (built into `/`), with no sidebar.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, membership, tenant } = await requireAuth();

  if (membership.role === 'TECHNICIAN') return <>{children}</>;

  const canManageOnboarding = membership.role === 'OWNER' || membership.role === 'ADMIN';
  const onboardingIncomplete = canManageOnboarding && !isChecklistComplete(await getOnboardingChecklist(tenantDb(tenant.id), tenant, user));
  // Once the owner has seen the trial-ended screen, the countdown banner would just be a stale
  // "ends today" forever — stop nagging and let the Team/Growth badges do any further upselling.
  const daysLeft = membership.role === 'OWNER' && !tenant.trialEndScreenShownAt ? trialDaysLeft(tenant) : null;
  const trialBanner = daysLeft != null && daysLeft <= TRIAL_BANNER_FROM_DAY ? { daysLeft } : null;

  return (
    <AppChrome
      userName={user.name}
      businessName={tenant.businessName}
      role={membership.role}
      logout={logoutAction}
      securityReminder={membership.role === 'OWNER' && !user.totpEnabled}
      trialBanner={trialBanner}
      showGettingStarted={onboardingIncomplete}
      showMyDay={membership.doesFieldwork}
      isPlatformAdmin={user.isPlatformAdmin}
    >
      {children}
    </AppChrome>
  );
}
