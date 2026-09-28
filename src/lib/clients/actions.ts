'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth/session';
import { ClientSchema } from './schema';
import { createClient, normalizePhone } from './create';

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; ok?: string } | undefined;

export async function createClientAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = ClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  await createClient(tenantDb(tenant.id), tenant, d);

  revalidatePath('/clients');
  return { ok: `${d.firstName} was added.` };
}

// Only these two builders start from "no client yet", so a new client can go straight into one.
const REDIRECT_TARGETS = new Set(['/quotes/new', '/invoices/new']);

const ClientForRedirectSchema = ClientSchema.and(z.object({ returnTo: z.enum(['/quotes/new', '/invoices/new']) }));

/** Same as createClientAction, but for starting a quote or invoice with a brand-new client: creates them, then goes straight into the builder. */
export async function createClientForRedirectAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = ClientForRedirectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { returnTo, ...d } = parsed.data;
  if (!REDIRECT_TARGETS.has(returnTo)) return { error: 'Something went wrong. Please try again.' };

  const client = await createClient(tenantDb(tenant.id), tenant, d);
  redirect(`${returnTo}?client=${client.id}`);
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
