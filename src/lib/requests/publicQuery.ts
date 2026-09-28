import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * The one allowed use of the raw (non-tenant-scoped) Prisma client: looking
 * up a business by its public booking slug, for the unauthenticated
 * /book/<slug> page (docs/plans/onboarding.md, "Google Business Profile").
 * There is no logged-in business here — the slug itself is what scopes this.
 *
 * Selects only fields safe to show a stranger who found this business on
 * Google: never bank details, VAT number, or anything from settings.
 */
export async function getTenantForBooking(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      businessName: true,
      tradingName: true,
      logoUrl: true,
      phone: true,
      whatsappNumber: true,
      city: true,
      region: true,
    },
  });
}

export type BookingTenant = NonNullable<Awaited<ReturnType<typeof getTenantForBooking>>>;
