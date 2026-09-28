import { z } from 'zod';

export const BROADCAST_KINDS = ['SERVICE_NOTICE', 'PROMOTION'] as const;
export const BROADCAST_CHANNELS = ['WHATSAPP_LIST', 'EMAIL'] as const;
export const RECENCY_OPTIONS = ['any', 'worked_recent', 'worked_stale'] as const;
export type RecencyOption = (typeof RECENCY_OPTIONS)[number];

export const AudienceFiltersSchema = z.object({
  place: z.string().trim().max(120).optional(),
  recency: z.enum(RECENCY_OPTIONS).default('any'),
  recencyMonths: z.coerce.number().int().min(1).max(36).optional(),
});
export type AudienceFilters = z.infer<typeof AudienceFiltersSchema>;

export const BroadcastComposeSchema = AudienceFiltersSchema.extend({
  kind: z.enum(BROADCAST_KINDS),
  channel: z.enum(BROADCAST_CHANNELS),
  body: z.string().trim().min(1, 'Write a message.').max(2000, 'Keep it under 2000 characters.'),
});
export type BroadcastCompose = z.infer<typeof BroadcastComposeSchema>;

/** A rough nudge, not a block: does this "service notice" read like it's selling something? */
export function looksLikeASale(body: string): boolean {
  const lower = body.toLowerCase();
  return /r\s?\d/.test(lower) || lower.includes('%') || lower.includes('special') || lower.includes('discount') || lower.includes('sale');
}

/** Fills in {firstName} for one recipient. Unknown placeholders are left as-is. */
export function applyMergeFields(body: string, client: { firstName: string }): string {
  return body.replaceAll('{firstName}', client.firstName);
}
