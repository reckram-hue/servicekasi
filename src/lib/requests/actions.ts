'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { createClient } from '@/lib/clients/create';
import { normalizeSaPhone } from '@/lib/southAfrica';

export type VoiceRequestFormState = { error?: string; ok?: boolean } | undefined;

const NAME_MAX = 100;
const DESCRIPTION_MAX = 2000;

/** Creates a request from a voice memo's (owner-reviewed) transcript. The audio itself was never stored. */
export async function createVoiceRequestAction(_: VoiceRequestFormState, formData: FormData): Promise<VoiceRequestFormState> {
  const { tenant } = await requireRole();

  const contactName = String(formData.get('contactName') ?? '').trim();
  const contactPhone = String(formData.get('contactPhone') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const transcript = String(formData.get('transcript') ?? '').trim();
  const preferredDateRaw = String(formData.get('preferredDate') ?? '').trim();

  if (contactName.length > NAME_MAX) return { error: `Please keep the name under ${NAME_MAX} characters.` };
  if (!description || description.length < 3) return { error: 'Add a bit more detail before saving.' };
  if (description.length > DESCRIPTION_MAX) return { error: `Please keep this under ${DESCRIPTION_MAX} characters.` };

  let preferredDate: Date | undefined;
  if (preferredDateRaw) {
    const parsed = new Date(`${preferredDateRaw}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) preferredDate = parsed;
  }

  await tenantDb(tenant.id).serviceRequest.create({
    data: {
      tenantId: tenant.id,
      source: 'VOICE_MEMO',
      contactName: contactName || null,
      contactPhone: contactPhone ? normalizeSaPhone(contactPhone) : null,
      description,
      transcript: transcript || null,
      preferredDate,
    },
  });

  revalidatePath('/requests');
  return { ok: true };
}

/** A lead that isn't going anywhere — no client created, no note kept beyond the request itself. */
export async function dismissRequestAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const id = String(formData.get('id') ?? '');

  await tenantDb(tenant.id).serviceRequest.updateMany({ where: { id, status: 'NEW' }, data: { status: 'DISMISSED' } });
  revalidatePath('/requests');
}

/**
 * Turns a lead into a real client, using the name and phone they gave when
 * requesting a quote — so the owner never has to retype them. From there,
 * the existing "New quote" / "New job" buttons on the client take over.
 */
export async function addRequestAsClientAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const id = String(formData.get('id') ?? '');

  const db = tenantDb(tenant.id);
  const request = await db.serviceRequest.findUnique({ where: { id } });
  if (!request || request.status !== 'NEW') return;

  const [firstName, ...rest] = (request.contactName || 'New client').trim().split(/\s+/);
  const client = await createClient(db, tenant, {
    firstName,
    lastName: rest.join(' ') || undefined,
    phone: request.contactPhone || undefined,
    preferredLanguage: 'en',
    notes: request.description,
  });

  await db.serviceRequest.updateMany({ where: { id, status: 'NEW' }, data: { status: 'CONVERTED', clientId: client.id } });
  revalidatePath('/requests');
  // Straight to the new client, where "New quote" / "New job" are one click away.
  redirect(`/clients?q=${encodeURIComponent(client.phone ?? client.firstName)}`);
}
