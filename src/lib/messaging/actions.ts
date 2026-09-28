'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { tenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth/session';
import { canUse } from '@/lib/plans/plans';
import { AudienceFiltersSchema, BroadcastComposeSchema, BROADCAST_CHANNELS, BROADCAST_KINDS } from './schema';
import { resolveAudience } from './audience';

const PreviewSchema = AudienceFiltersSchema.extend({
  kind: z.enum(BROADCAST_KINDS),
  channel: z.enum(BROADCAST_CHANNELS),
});

export type PreviewState =
  | { total: number; skippedOptedOut: number; skippedNoContact: number; error?: undefined }
  | { error: string }
  | undefined;

export async function previewAudienceAction(_: PreviewState, formData: FormData): Promise<PreviewState> {
  const { tenant } = await requireRole();
  const parsed = PreviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Something went wrong building the preview.' };

  const db = tenantDb(tenant.id);
  const { reachable, skipped } = await resolveAudience(db, parsed.data, parsed.data.kind, parsed.data.channel);

  return {
    total: reachable.length,
    skippedOptedOut: skipped.filter((s) => s.reason === 'opted_out').length,
    skippedNoContact: skipped.filter((s) => s.reason === 'no_phone' || s.reason === 'no_email').length,
  };
}

export type ComposeFormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> } | undefined;

export async function createBroadcastAction(_: ComposeFormState, formData: FormData): Promise<ComposeFormState> {
  const { tenant, membership } = await requireRole();
  if (!canUse(tenant, 'whatsappBroadcasts')) return { error: 'WhatsApp broadcasts need the Team package or higher.' };

  const parsed = BroadcastComposeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  if (d.channel !== 'WHATSAPP_LIST') return { error: 'Only WhatsApp broadcasts are available right now.' };

  const db = tenantDb(tenant.id);
  const { reachable, skipped } = await resolveAudience(db, d, d.kind, d.channel);
  if (reachable.length === 0) return { error: 'No clients match this audience — nothing to send.' };

  const body = d.kind === 'PROMOTION' ? `${d.body}\n\nReply STOP to opt out of promotions.` : d.body;

  const broadcast = await db.broadcast.create({
    data: {
      tenantId: tenant.id,
      kind: d.kind,
      channel: d.channel,
      body,
      audience: { place: d.place || null, recency: d.recency, recencyMonths: d.recencyMonths ?? null },
      createdByMembershipId: membership.id,
      recipients: {
        create: [
          ...reachable.map((c) => ({ tenantId: tenant.id, clientId: c.id, status: 'PENDING' as const })),
          ...skipped.map((s) => ({ tenantId: tenant.id, clientId: s.clientId, status: 'SKIPPED' as const, skipReason: s.reason })),
        ],
      },
    },
  });

  revalidatePath('/messages');
  redirect(`/messages/${broadcast.id}`);
}

export async function markRecipientSentAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const id = String(formData.get('recipientId') ?? '');
  const broadcastId = String(formData.get('broadcastId') ?? '');

  const db = tenantDb(tenant.id);
  await db.broadcastRecipient.update({
    where: { id },
    data: { status: 'SENT', sentAt: new Date() },
  });

  const remaining = await db.broadcastRecipient.count({ where: { broadcastId, status: 'PENDING' } });
  if (remaining === 0) {
    await db.broadcast.update({ where: { id: broadcastId }, data: { sentAt: new Date() } });
  }

  revalidatePath(`/messages/${broadcastId}`);
}
