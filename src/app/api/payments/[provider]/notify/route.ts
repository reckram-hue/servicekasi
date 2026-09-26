import { handleProviderNotification } from '@/lib/payments/online';

/**
 * Server-to-server payment confirmations (PayFast's "ITN"). Public: the
 * provider has no session. Everything is verified before anything is recorded.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const body = await request.text();
  const result = await handleProviderNotification(provider, body);
  if (!result.ok) console.warn(`[payments] ${provider} notification rejected: ${result.reason}`);
  // 200 once handled (even "not completed"), so the provider stops retrying; 400 for anything we refused.
  return new Response(result.ok ? 'OK' : 'Rejected', { status: result.ok ? 200 : 400 });
}
