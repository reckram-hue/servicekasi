import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * The one allowed use of the raw (non-tenant-scoped) Prisma client: looking
 * up a quote by its public approval token, for the unauthenticated /q/<token>
 * page. There is no logged-in business here, so tenantDb() cannot apply —
 * the token itself (an unguessable UUID) is what scopes this query.
 *
 * Selects only the fields the client-facing page shows. Cost prices and
 * margins are never selected here, so there is no way for this function to
 * accidentally leak them to the public page.
 */
export async function getPublicQuoteByToken(token: string) {
  return prisma.quote.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      number: true,
      title: true,
      notes: true,
      status: true,
      validUntil: true,
      depositPercent: true,
      depositCents: true,
      subtotalCents: true,
      taxCents: true,
      totalCents: true,
      publicToken: true,
      updatedAt: true,
      sentAt: true,
      approvedAt: true,
      approvedByName: true,
      clientMessage: true,
      client: {
        select: { firstName: true, lastName: true, companyName: true },
      },
      property: {
        select: { street: true, suburb: true, city: true },
      },
      tenant: {
        select: {
          businessName: true,
          tradingName: true,
          logoUrl: true,
          phone: true,
          email: true,
          whatsappNumber: true,
          currencyCode: true,
          timezone: true,
        },
      },
      lines: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPriceCents: true,
          taxRateBp: true,
          optional: true,
          selected: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

export type PublicQuote = NonNullable<Awaited<ReturnType<typeof getPublicQuoteByToken>>>;
