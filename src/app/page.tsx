import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/session';
import { logoutAction } from '@/lib/auth/actions';
import { AppShell } from '@/components/AppShell';

export default async function Home() {
  const { user, membership, tenant } = await requireAuth();

  // Owners must have the authenticator app switched on before going further.
  if (membership.role === 'OWNER' && !user.totpEnabled) redirect('/settings/security');

  if (membership.role === 'TECHNICIAN') {
    // The technician mobile view is wired to real jobs in Phase 2.
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <h1 className="text-xl font-semibold">Hi {user.name}</h1>
        <p className="mt-2 text-slate-400">Your jobs for today will appear here.</p>
        <form action={logoutAction} className="mt-6">
          <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm">Log out</button>
        </form>
      </div>
    );
  }

  return (
    <AppShell userName={user.name} businessName={tenant.businessName} role={membership.role} logout={logoutAction} />
  );
}
