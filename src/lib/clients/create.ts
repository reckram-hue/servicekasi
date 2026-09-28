import 'server-only';
import type { Tenant } from '@prisma/client';
import type { TenantDb } from '@/lib/db';
import { normalizeSaPhone } from '@/lib/southAfrica';
import type { ClientInput } from './schema';

export function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  return normalizeSaPhone(raw);
}

/** True once enough of the address has been filled in to be worth saving. */
export function hasAddress(d: { street?: string; city?: string }) {
  return !!(d.street && d.city);
}

export async function createClient(db: TenantDb, tenant: Pick<Tenant, 'id' | 'countryCode'>, d: ClientInput) {
  return db.client.create({
    data: {
      tenantId: tenant.id, // tenantDb also injects this; kept explicit to satisfy TypeScript
      firstName: d.firstName,
      lastName: d.lastName || undefined,
      companyName: d.companyName || undefined,
      phone: normalizePhone(d.phone),
      email: d.email || undefined,
      preferredLanguage: d.preferredLanguage,
      notes: d.notes || undefined,
      whatsappOptIn: d.whatsappOptIn === 'on',
      consentRecordedAt: d.whatsappOptIn === 'on' ? new Date() : undefined,
      properties: hasAddress(d)
        ? {
            create: {
              tenantId: tenant.id,
              street: d.street!,
              suburb: d.suburb || undefined,
              city: d.city!,
              region: d.region || undefined,
              postalCode: d.postalCode || undefined,
              countryCode: tenant.countryCode,
              accessNotes: d.accessNotes || undefined,
            },
          }
        : undefined,
    },
  });
}
