'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { JobPriority } from '@prisma/client';
import { requireRole } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { tenantDb, nextDocumentNumber } from '@/lib/db';
import { createClient } from '@/lib/clients/create';
import { normalizeSaPhone } from '@/lib/southAfrica';
import { zonedDateTime } from '@/lib/dates';
import { syncJobStatus } from '@/lib/jobs/status';
import { canUse } from '@/lib/plans/plans';

export type VoiceRequestFormState = { error?: string; ok?: boolean } | undefined;

const NAME_MAX = 100;
const DESCRIPTION_MAX = 2000;
const VISIT_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_VISIT_MINUTES = 60;
const PRIORITIES: JobPriority[] = ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'];

/**
 * Creates a request from a voice memo's (owner-reviewed) transcript. The audio itself was
 * never stored. If a visit date + start time were given, this books it straight onto the
 * calendar instead of leaving it as a lead to action later — see docs/plans/voice-request-capture.md.
 */
export async function createVoiceRequestAction(_: VoiceRequestFormState, formData: FormData): Promise<VoiceRequestFormState> {
  const { tenant } = await requireRole();
  if (!canUse(tenant, 'voiceMemoCapture')) return { error: 'Voice memo capture needs the Growth package.' };
  const db = tenantDb(tenant.id);

  const contactName = String(formData.get('contactName') ?? '').trim();
  const contactPhone = String(formData.get('contactPhone') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const transcript = String(formData.get('transcript') ?? '').trim();
  const preferredDateRaw = String(formData.get('preferredDate') ?? '').trim();
  const visitDate = String(formData.get('visitDate') ?? '').trim();
  const visitStartTime = String(formData.get('visitStartTime') ?? '').trim();
  const technicianIdsJson = String(formData.get('technicianIdsJson') ?? '[]');
  const priorityRaw = String(formData.get('priority') ?? 'NORMAL');
  const priority = PRIORITIES.includes(priorityRaw as JobPriority) ? (priorityRaw as JobPriority) : 'NORMAL';

  if (contactName.length > NAME_MAX) return { error: `Please keep the name under ${NAME_MAX} characters.` };
  if (!description || description.length < 3) return { error: 'Add a bit more detail before saving.' };
  if (description.length > DESCRIPTION_MAX) return { error: `Please keep this under ${DESCRIPTION_MAX} characters.` };

  const normalizedPhone = contactPhone ? normalizeSaPhone(contactPhone) : null;

  if (visitDate && visitStartTime) {
    if (!VISIT_TIME.test(visitStartTime)) return { error: 'Choose a valid start time.' };

    let technicianIds: string[];
    try {
      technicianIds = [...new Set(JSON.parse(technicianIdsJson) as string[])];
    } catch {
      technicianIds = [];
    }
    if (technicianIds.length === 0) return { error: 'Choose who this appointment is for.' };
    const validCount = await db.membership.count({
      where: { id: { in: technicianIds }, OR: [{ role: 'TECHNICIAN' }, { doesFieldwork: true }], active: true },
    });
    if (validCount !== technicianIds.length) return { error: 'One or more technicians could not be found.' };

    const startsAt = zonedDateTime(visitDate, visitStartTime);
    const endsAt = new Date(startsAt.getTime() + DEFAULT_VISIT_MINUTES * 60_000);

    // Same phone, same client — don't create a duplicate every time a returning caller phones in.
    const existingClient = normalizedPhone ? await db.client.findFirst({ where: { tenantId: tenant.id, phone: normalizedPhone } }) : null;
    const clientId = existingClient
      ? existingClient.id
      : (
          await createClient(db, tenant, {
            firstName: (contactName || 'New client').trim().split(/\s+/)[0],
            lastName: contactName.trim().split(/\s+/).slice(1).join(' ') || undefined,
            phone: contactPhone || undefined,
            preferredLanguage: 'en',
            notes: description,
          })
        ).id;

    const request = await db.serviceRequest.create({
      data: {
        tenantId: tenant.id,
        source: 'VOICE_MEMO',
        status: 'CONVERTED',
        clientId,
        contactName: contactName || null,
        contactPhone: normalizedPhone,
        description,
        transcript: transcript || null,
      },
    });

    const job = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, tenant.id, 'JOB');
      const created = await tx.job.create({
        data: {
          tenantId: tenant.id,
          number,
          clientId,
          requestId: request.id,
          title: description.slice(0, 100),
          description,
          priority,
        },
      });
      await tx.visit.create({
        data: {
          tenantId: tenant.id,
          jobId: created.id,
          startsAt,
          endsAt,
          assignments: { create: technicianIds.map((membershipId) => ({ membershipId })) },
        },
      });
      await syncJobStatus(tx, created.id);
      return created;
    });

    revalidatePath('/requests');
    revalidatePath('/jobs');
    revalidatePath('/schedule');
    redirect(`/jobs/${job.id}`);
  }

  let preferredDate: Date | undefined;
  if (preferredDateRaw) {
    const parsed = new Date(`${preferredDateRaw}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) preferredDate = parsed;
  }

  await db.serviceRequest.create({
    data: {
      tenantId: tenant.id,
      source: 'VOICE_MEMO',
      contactName: contactName || null,
      contactPhone: normalizedPhone,
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
