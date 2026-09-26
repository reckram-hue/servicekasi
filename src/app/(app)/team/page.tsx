import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { AddTechnicianForm, ResetPinForm } from '@/components/auth/TeamForms';

const ROLE_LABEL = { OWNER: 'Owner', ADMIN: 'Admin', DISPATCHER: 'Office', TECHNICIAN: 'Technician' } as const;

export default async function TeamPage() {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const members = await tenantDb(tenant.id).membership.findMany({
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold">Team — {tenant.businessName}</h1>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900">
            {members.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 border-b border-slate-800 p-4 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{m.user.name}</div>
                    <div className="text-xs text-slate-400">
                      {m.user.email ?? m.user.phone} · {ROLE_LABEL[m.role]} · language: {m.user.preferredLanguage}
                    </div>
                  </div>
                </div>
                {m.role === 'TECHNICIAN' && <ResetPinForm membershipId={m.id} />}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 font-semibold">Add a technician</h2>
            <AddTechnicianForm />
          </div>
        </div>
      </div>
    </div>
  );
}
