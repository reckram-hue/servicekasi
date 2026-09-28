import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * The one allowed use of the raw (non-tenant-scoped) Prisma client: looking
 * up a client by their unsubscribe token, for the unauthenticated /u/<token>
 * page. There is no logged-in business here, so tenantDb() cannot apply —
 * the token itself (an unguessable UUID) is what scopes this query.
 */
export async function getClientByUnsubscribeToken(token: string) {
  return prisma.client.findUnique({
    where: { unsubscribeToken: token },
    select: {
      id: true,
      firstName: true,
      marketingOptOutAt: true,
      tenant: {
        select: { businessName: true, tradingName: true },
      },
    },
  });
}

export type PublicUnsubscribeClient = NonNullable<Awaited<ReturnType<typeof getClientByUnsubscribeToken>>>;
