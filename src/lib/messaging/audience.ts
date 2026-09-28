import 'server-only';
import type { TenantDb } from '@/lib/db';
import type { BroadcastChannel, BroadcastKind } from '@prisma/client';
import type { AudienceFilters } from './schema';

export type SkipReason = 'opted_out' | 'no_phone' | 'no_email';

export type ReachableClient = { id: string; firstName: string; phone: string | null; email: string | null };

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

/** Every suburb and city that appears on a client's property, for the audience place picker. */
export async function listAudiencePlaces(db: TenantDb): Promise<string[]> {
  const properties = await db.property.findMany({ select: { suburb: true, city: true } });
  const set = new Set<string>();
  for (const p of properties) {
    if (p.suburb) set.add(p.suburb);
    if (p.city) set.add(p.city);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Clients matching the audience filters, split into who can actually be
 * reached on the chosen channel and who would be skipped (with why). Shared
 * by the live preview (Step 2) and by creating the real broadcast recipients
 * (Step 3), so the number the owner sees always matches what gets sent.
 */
export async function resolveAudience(
  db: TenantDb,
  filters: AudienceFilters,
  kind: BroadcastKind,
  channel: BroadcastChannel
): Promise<{ reachable: ReachableClient[]; skipped: { clientId: string; reason: SkipReason }[] }> {
  const place = filters.place?.trim().toLowerCase();
  const cutoff = filters.recency !== 'any' && filters.recencyMonths ? monthsAgo(filters.recencyMonths) : null;

  const clients = await db.client.findMany({
    where: { archived: false },
    select: {
      id: true,
      firstName: true,
      phone: true,
      email: true,
      marketingOptOutAt: true,
      properties: { select: { suburb: true, city: true } },
      invoices: {
        where: { kind: { not: 'CREDIT_NOTE' }, issuedAt: { not: null } },
        select: { issuedAt: true },
        orderBy: { issuedAt: 'desc' },
        take: 1,
      },
    },
  });

  const reachable: ReachableClient[] = [];
  const skipped: { clientId: string; reason: SkipReason }[] = [];

  for (const c of clients) {
    if (place) {
      const matches = c.properties.some((p) => p.suburb?.toLowerCase() === place || p.city?.toLowerCase() === place);
      if (!matches) continue;
    }

    if (cutoff) {
      const lastWorked = c.invoices[0]?.issuedAt ?? null;
      const workedRecently = !!lastWorked && lastWorked >= cutoff;
      if (filters.recency === 'worked_recent' && !workedRecently) continue;
      if (filters.recency === 'worked_stale' && workedRecently) continue;
    }

    if (kind === 'PROMOTION' && c.marketingOptOutAt) {
      skipped.push({ clientId: c.id, reason: 'opted_out' });
      continue;
    }
    if (channel === 'WHATSAPP_LIST' && !c.phone) {
      skipped.push({ clientId: c.id, reason: 'no_phone' });
      continue;
    }
    if (channel === 'EMAIL' && !c.email) {
      skipped.push({ clientId: c.id, reason: 'no_email' });
      continue;
    }

    reachable.push({ id: c.id, firstName: c.firstName, phone: c.phone, email: c.email });
  }

  return { reachable, skipped };
}
