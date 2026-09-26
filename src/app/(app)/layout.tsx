import { requireAuth } from '@/lib/auth/session';
import { logoutAction } from '@/lib/auth/actions';
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

  return (
    <AppChrome userName={user.name} businessName={tenant.businessName} role={membership.role} logout={logoutAction}>
      {children}
    </AppChrome>
  );
}
