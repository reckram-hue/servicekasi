import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/session';
import { TechnicianDay } from '@/components/technician/TechnicianDay';

/**
 * For an owner/admin/dispatcher who also does fieldwork themselves (common
 * for a sole operator) — the same day view a technician gets, without
 * needing a second phone+PIN login. Full office chrome (sidebar) stays;
 * this is just one more page inside it.
 */
export default async function MyDayPage() {
  const { membership, tenant } = await requireAuth();
  if (!membership.doesFieldwork) redirect('/');

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-4 text-2xl font-bold">My day</h1>
        <TechnicianDay tenant={{ id: tenant.id, timezone: tenant.timezone }} membershipId={membership.id} />
      </div>
    </div>
  );
}
