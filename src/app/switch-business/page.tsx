import { AuthCard } from '@/components/auth/ui';
import { SwitchBusinessForm } from '@/components/auth/BusinessAccessForms';
import { requireSignedIn } from '@/lib/auth/session';
import { logoutAction } from '@/lib/auth/actions';
import { prisma } from '@/lib/prisma';

// Outside the tenant layout so helpers can recover after access is revoked.
export default async function SwitchBusinessPage() {
  const session = await requireSignedIn();
  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId, active: true },
    select: { role: true, tenant: { select: { id: true, businessName: true } } }, orderBy: { createdAt: 'asc' },
  });
  const labels = { OWNER: 'Owner', ADMIN: 'Administrator', DISPATCHER: 'Office', TECHNICIAN: 'Technician' };
  return <AuthCard title="Switch business" subtitle={`Signed in as ${session.user.name}`}>
    {memberships.length ? <SwitchBusinessForm activeTenantId={session.activeTenantId} businesses={memberships.map((m) => ({ id: m.tenant.id, name: m.tenant.businessName, role: labels[m.role] }))} />
      : <p className="text-sm text-slate-300">You don’t currently have access to a business. Ask the owner to grant access to your login email.</p>}
    <form action={logoutAction} className="mt-5 text-center"><button className="text-sm text-amber-400 hover:underline">Log out</button></form>
  </AuthCard>;
}
