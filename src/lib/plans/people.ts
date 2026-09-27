import 'server-only';
import type { Tenant } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { personLimit } from './plans';

export const PAUSED_LOGIN_MESSAGE =
  'Your business has more people logged in than its current package allows. Ask the owner to upgrade, or free up a seat, then try again.';

/**
 * Memberships beyond the package's people limit — paused, not removed (decision 4).
 * The oldest active memberships keep their seats; whoever joined last is paused
 * first, so the owner (created at signup) is never paused by this.
 */
export async function pausedMembershipIds(tenant: Pick<Tenant, 'id' | 'plan' | 'subscriptionStatus' | 'trialEndsAt'>): Promise<Set<string>> {
  const limit = personLimit(tenant);
  if (limit == null) return new Set();

  const active = await prisma.membership.findMany({
    where: { tenantId: tenant.id, active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return new Set(active.slice(limit).map((m) => m.id));
}
