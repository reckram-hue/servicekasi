import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { canUse, minimumPlanFor, PLAN_LABEL } from '@/lib/plans/plans';

export default async function MessagesPage() {
  const { tenant } = await requireRole();
  const allowed = canUse(tenant, 'whatsappBroadcasts');

  const broadcasts = allowed
    ? await tenantDb(tenant.id).broadcast.findMany({
        include: { recipients: { select: { status: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    : [];

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Messages</h1>
          {allowed && (
            <Link href="/messages/new" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
              + New broadcast
            </Link>
          )}
        </div>

        {!allowed && (
          <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-400">
            WhatsApp broadcasts need the {PLAN_LABEL[minimumPlanFor('whatsappBroadcasts')]} package or higher.
          </p>
        )}

        {allowed && broadcasts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500">
            No broadcasts yet. Send your first update to clients.
          </p>
        )}

        {allowed && broadcasts.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            {broadcasts.map((b) => {
              const sent = b.recipients.filter((r) => r.status === 'SENT').length;
              const pending = b.recipients.filter((r) => r.status === 'PENDING').length;
              const skipped = b.recipients.filter((r) => r.status === 'SKIPPED').length;
              const reach = sent + pending;
              return (
                <Link
                  key={b.id}
                  href={`/messages/${b.id}`}
                  className="flex items-center justify-between gap-3 border-b border-slate-800 p-4 last:border-0 hover:bg-slate-800/50"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-100">{b.kind === 'PROMOTION' ? 'Promotion' : 'Service notice'}</div>
                    <div className="text-xs text-slate-500">
                      {b.createdAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <span className="text-right text-xs text-slate-400">
                    Reached {reach} · {sent} sent
                    {skipped > 0 && <span className="block text-slate-500">{skipped} skipped</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
