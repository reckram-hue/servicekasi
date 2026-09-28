import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { applyMergeFields } from '@/lib/messaging/schema';
import { SendListItem } from '@/components/messaging/SendListItem';

export default async function BroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireRole();
  const { id } = await params;

  const broadcast = await tenantDb(tenant.id).broadcast.findUnique({
    where: { id },
    include: {
      recipients: {
        include: { client: { select: { firstName: true, lastName: true, phone: true } } },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!broadcast) notFound();

  const sentCount = broadcast.recipients.filter((r) => r.status === 'SENT').length;
  const pendingCount = broadcast.recipients.filter((r) => r.status === 'PENDING').length;
  const skippedCount = broadcast.recipients.filter((r) => r.status === 'SKIPPED').length;
  const reachCount = sentCount + pendingCount;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-lg">
        <Link href="/messages" className="text-sm text-amber-400 hover:underline">
          ← Messages
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{broadcast.kind === 'PROMOTION' ? 'Promotion' : 'Service notice'}</h1>
          <span className="text-xs text-slate-500">
            {broadcast.createdAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <p className="mb-4 mt-3 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">{broadcast.body}</p>
        <p className="mb-4 text-sm text-slate-400">
          Reached {reachCount} · {sentCount} sent · {pendingCount} to go
          {skippedCount > 0 && ` · ${skippedCount} skipped`}
          {pendingCount === 0 && ' · all done'}
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {broadcast.recipients.map((r) => (
            <SendListItem
              key={r.id}
              recipientId={r.id}
              broadcastId={broadcast.id}
              name={[r.client.firstName, r.client.lastName].filter(Boolean).join(' ')}
              phone={r.client.phone}
              message={applyMergeFields(broadcast.body, r.client)}
              status={r.status}
              skipReason={r.skipReason}
              sentAt={r.sentAt}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
