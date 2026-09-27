import { requireAuth } from '@/lib/auth/session';
import { logoutAction } from '@/lib/auth/actions';
import { tenantDb } from '@/lib/db';
import { getOnboardingChecklist, isChecklistComplete } from '@/lib/onboarding/checklist';
import { AppChrome } from '@/components/AppChrome';

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

  return (
    <AppChrome
      userName={user.name}
      businessName={tenant.businessName}
      role={membership.role}
      logout={logoutAction}
      securityReminder={membership.role === 'OWNER' && !user.totpEnabled}
      showGettingStarted={onboardingIncomplete}
      showMyDay={membership.doesFieldwork}
    >
      {children}
    </AppChrome>
  );
}
