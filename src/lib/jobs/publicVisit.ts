import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * Looks up a visit by its public token for the unauthenticated /eta/<token>
 * page a client gets by WhatsApp before a visit. There is no logged-in
 * business here, so tenantDb() cannot apply — the unguessable token is what
 * scopes this query.
 *
 * Selects only what reassures a client about who's arriving: never pricing,
 * the full job, or other clients' details.
 */
export async function getPublicVisitByToken(token: string) {
  const visit = await prisma.visit.findUnique({
    where: { publicToken: token },
    select: {
      startsAt: true,
      status: true,
      job: {
        select: {
          tenant: { select: { businessName: true, tradingName: true, logoUrl: true, timezone: true } },
          property: { select: { suburb: true, city: true } },
        },
      },
      assignments: {
        select: {
          membership: {
            select: { specialties: true, user: { select: { name: true, photoUrl: true } } },
          },
        },
      },
    },
  });
  if (!visit || visit.status === 'CANCELLED') return null;
  return visit;
}
