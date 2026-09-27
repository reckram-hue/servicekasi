import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { toggleDoesFieldworkAction } from '@/lib/auth/actions';
import { AddTechnicianForm, ResetPinForm, TechnicianPhotoUpload } from '@/components/auth/TeamForms';

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
                {m.role === 'TECHNICIAN' && (
                  <>
                    <TechnicianPhotoUpload membershipId={m.id} photoUrl={m.user.photoUrl} />
                    <p className="text-xs text-slate-500">Shown to clients on the &ldquo;who&apos;s coming&rdquo; link before a visit.</p>
                    <ResetPinForm membershipId={m.id} />
                  </>
                )}
                {m.role !== 'TECHNICIAN' && (
                  <form action={toggleDoesFieldworkAction} className="flex items-center gap-2">
                    <input type="hidden" name="membershipId" value={m.id} />
                    <input type="hidden" name="current" value={String(m.doesFieldwork)} />
                    <button type="submit" className="text-xs font-medium text-amber-400 hover:underline">
                      {m.doesFieldwork ? 'Stop assigning jobs to them' : 'Also does fieldwork — let me assign jobs to them'}
                    </button>
                  </form>
                )}
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
