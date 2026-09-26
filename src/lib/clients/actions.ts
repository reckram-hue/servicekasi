'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth/session';
import { normalizeSaPhone } from '@/lib/southAfrica';

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; ok?: string } | undefined;

const LANGUAGES = ['en', 'af', 'zu', 'xh', 'st', 'tn', 'nso', 'ts', 'ss', 've', 'nr', 'pt', 'sn', 'ny', 'sw', 'fr'] as const;

const ClientSchema = z
  .object({
    firstName: z.string().trim().min(1, { error: 'Enter a first name.' }),
    lastName: z.string().trim().optional(),
    companyName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.union([z.email({ error: 'Enter a valid email address.' }), z.literal('')]).optional(),
    preferredLanguage: z.enum(LANGUAGES).default('en'),
    notes: z.string().trim().optional(),
    whatsappOptIn: z.union([z.literal('on'), z.literal('')]).optional(),
    street: z.string().trim().optional(),
    suburb: z.string().trim().optional(),
    city: z.string().trim().optional(),
    region: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    accessNotes: z.string().trim().optional(),
  })
  .refine((d) => d.phone || d.email, {
    error: 'Enter a phone number or an email address.',
    path: ['phone'],
  });

function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const normalized = normalizeSaPhone(raw);
  return normalized;
}

/** True once enough of the address has been filled in to be worth saving. */
function hasAddress(d: { street?: string; city?: string }) {
  return !!(d.street && d.city);
}

export async function createClientAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = ClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const db = tenantDb(tenant.id);
  await db.client.create({
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

  revalidatePath('/clients');
  return { ok: `${d.firstName} was added.` };
}

const UpdateClientSchema = ClientSchema.and(z.object({ id: z.string().uuid() }));

export async function updateClientAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = UpdateClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const db = tenantDb(tenant.id);
  const existing = await db.client.findUnique({ where: { id: d.id } });
  if (!existing) return { error: 'Client not found.' };

  await db.client.update({
    where: { id: d.id },
    data: {
      firstName: d.firstName,
      lastName: d.lastName || null,
      companyName: d.companyName || null,
      phone: normalizePhone(d.phone) ?? null,
      email: d.email || null,
      preferredLanguage: d.preferredLanguage,
      notes: d.notes || null,
      whatsappOptIn: d.whatsappOptIn === 'on',
      consentRecordedAt:
        d.whatsappOptIn === 'on' && !existing.whatsappOptIn ? new Date() : existing.consentRecordedAt,
    },
  });

  revalidatePath('/clients');
  return { ok: 'Saved.' };
}

export async function toggleArchiveClientAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const id = String(formData.get('id') ?? '');
  const currentlyArchived = formData.get('archived') === 'true';

  const db = tenantDb(tenant.id);
  await db.client.update({ where: { id }, data: { archived: !currentlyArchived } });
  revalidatePath('/clients');
}
