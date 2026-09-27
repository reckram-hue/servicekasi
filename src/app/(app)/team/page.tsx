import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { toggleDoesFieldworkAction } from '@/lib/auth/actions';
import { personLimit } from '@/lib/plans/plans';
import { pausedMembershipIds } from '@/lib/plans/people';
import { AddTechnicianForm, ResetPinForm, TechnicianPhotoUpload } from '@/components/auth/TeamForms';

const ROLE_LABEL = { OWNER: 'Owner', ADMIN: 'Admin', DISPATCHER: 'Office', TECHNICIAN: 'Technician' } as const;

export default async function TeamPage() {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const members = await tenantDb(tenant.id).membership.findMany({
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  const paused = await pausedMembershipIds(tenant);
  const limit = personLimit(tenant);
  const activeCount = members.filter((m) => m.active).length;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-1 text-2xl font-bold">Team — {tenant.businessName}</h1>
        {limit != null && (
          <p className="mb-6 text-sm text-slate-400">
            {activeCount} of {limit} {limit === 1 ? 'seat' : 'seats'} used on your current package.{' '}
            {activeCount >= limit && (
              <Link href="/settings/package" className="font-semibold text-amber-400 hover:underline">
                Upgrade for more →
              </Link>
            )}
          </p>
        )}
        {limit == null && <div className="mb-6" />}

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900">
            {members.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 border-b border-slate-800 p-4 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {m.user.name}
                      {paused.has(m.id) && (
                        <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          Paused — over your package&apos;s limit
                        </span>
                      )}
                    </div>
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
            {limit != null && activeCount >= limit ? (
              <div className="rounded-xl border border-amber-800 bg-amber-500/10 p-4 text-sm text-amber-200">
                <p className="mb-3">You&apos;ve used all {limit} seats on your current package.</p>
                <Link href="/settings/package" className="inline-block rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-400">
                  Upgrade for more seats
                </Link>
              </div>
            ) : (
              <AddTechnicianForm />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
