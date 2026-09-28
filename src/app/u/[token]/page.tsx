import { notFound } from 'next/navigation';
import { getClientByUnsubscribeToken } from '@/lib/messaging/publicQuery';
import { UnsubscribeView } from '@/components/messaging/UnsubscribeView';

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await getClientByUnsubscribeToken(token);
  if (!client) notFound();

  const businessName = client.tenant.tradingName || client.tenant.businessName;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md pt-10">
        <div className="mb-6 text-center text-xl font-bold text-amber-400">{businessName}</div>
        <UnsubscribeView
          token={token}
          firstName={client.firstName}
          businessName={businessName}
          alreadyOptedOut={!!client.marketingOptOutAt}
        />
      </div>
    </div>
  );
}
