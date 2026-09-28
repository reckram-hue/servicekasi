import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { canUse } from '@/lib/plans/plans';
import { listAudiencePlaces } from '@/lib/messaging/audience';
import { ComposeBroadcastForm } from '@/components/messaging/ComposeBroadcastForm';

export default async function NewMessagePage() {
  const { tenant } = await requireRole();
  if (!canUse(tenant, 'whatsappBroadcasts')) redirect('/messages');

  const places = await listAudiencePlaces(tenantDb(tenant.id));

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-lg">
        <Link href="/messages" className="text-sm text-amber-400 hover:underline">
          ← Messages
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">New broadcast</h1>
        <ComposeBroadcastForm places={places} />
      </div>
    </div>
  );
}
