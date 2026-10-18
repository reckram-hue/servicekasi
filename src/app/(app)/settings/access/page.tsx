import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { personLimit } from '@/lib/plans/plans';
import { GrantBusinessAccessForm, RevokeBusinessAccessForm } from '@/components/auth/BusinessAccessForms';

export default async function BusinessAccessPage() {
  const { tenant } = await requireRole(['OWNER']);
  const [helpers, used, history] = await Promise.all([
    prisma.membership.findMany({ where: { tenantId: tenant.id, role: 'ADMIN', active: true },
      select: { id: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.membership.count({ where: { tenantId: tenant.id, active: true } }),
    prisma.auditLog.findMany({ where: { tenantId: tenant.id, action: { in: ['access.granted', 'access.revoked'] } },
      orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, action: true, createdAt: true, details: true } }),
  ]);
  const limit = personLimit(tenant);
  return <div className="min-h-screen px-4 py-8 text-slate-100"><div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-bold">Helper access — {tenant.businessName}</h1>
      <p className="mt-2 text-sm text-slate-400">Let someone you trust help you set up and run your business using their own ServiceKasi login. You can revoke access here at any time.</p></div>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="mb-2 font-semibold">Grant administrator access</h2>
      <p className="mb-3 text-sm text-slate-400">Helpers can view and edit business details, customers, jobs, invoices, bookkeeping and team members. Only you can manage helper access or choose your package.</p>
      <p className="mb-4 text-sm text-slate-400">Use the email they already use to log in to ServiceKasi. Each helper uses one team seat. {limit == null ? `${used} seats in use.` : `${used} of ${limit} seats in use.`} After granting access, ask them to open Switch business in their menu.</p>
      {limit != null && used >= limit ? <p className="text-sm text-amber-300">No spare seats. <Link href="/settings/package" className="underline">Review your package</Link> to add a helper.</p> : <GrantBusinessAccessForm />}
    </section>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="mb-4 font-semibold">Helpers with access</h2>
      {!helpers.length && <p className="text-sm text-slate-400">No helpers have access yet.</p>}
      {helpers.map((helper) => <div key={helper.id} className="space-y-2 border-t border-slate-800 py-4 first:border-0">
        <div><p className="font-medium">{helper.user.name}</p><p className="text-sm text-slate-400">{helper.user.email} · Administrator</p></div>
        <RevokeBusinessAccessForm membershipId={helper.id} name={helper.user.name} />
      </div>)}
    </section>
    {!!history.length && <section><h2 className="mb-3 font-semibold">Recent access changes</h2><ul className="space-y-2 text-sm text-slate-400">
      {history.map((entry) => {
        const details = entry.details as { email?: string } | null;
        return <li key={entry.id}>{entry.createdAt.toLocaleString('en-ZA', { timeZone: tenant.timezone })} — {entry.action === 'access.granted' ? 'Access granted' : 'Access revoked'}{details?.email ? `: ${details.email}` : ''}</li>;
      })}
    </ul></section>}
  </div></div>;
}
