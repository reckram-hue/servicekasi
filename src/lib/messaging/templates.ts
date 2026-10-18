import { z } from 'zod';
import { normalizeSaPhone } from '@/lib/southAfrica';

export const TEMPLATE_IDS = ['confirmation', 'on_the_way', 'running_late', 'thank_you'] as const;
export const TEMPLATE_TOKENS = ['customer', 'business', 'date', 'time', 'review_link'] as const;
export const ECO4_REVIEW_URL = 'https://share.google/XsDrZgpRVE6tlZ9Zw';

const bodySchema = z.string().trim().min(1).max(2000).refine(
  (body) => [...body.matchAll(/\[([a-z_]+)\]/gi)].every((m) => TEMPLATE_TOKENS.some((t) => t === m[1])),
  'Use only [customer], [business], [date], [time] and [review_link] placeholders.',
);
export const TemplatesSchema = z.array(z.object({
  id: z.enum(TEMPLATE_IDS), title: z.string().trim().min(1).max(60), body: bodySchema,
})).length(4).refine((items) => new Set(items.map((item) => item.id)).size === 4, 'Keep all four templates.');
export type WhatsAppTemplate = z.infer<typeof TemplatesSchema>[number];

export const ReviewUrlSchema = z.string().trim().max(1000).refine((value) => {
  if (!value) return true;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}, 'Enter a valid http or https review link.');

export function defaultTemplates(mobileCarWash = false): WhatsAppTemplate[] {
  const booking = mobileCarWash ? 'wash booking' : 'booking';
  return [
    { id: 'confirmation', title: 'Booking confirmation', body: `Hi [customer], your [business] ${booking} is confirmed for [date] at [time]. Please let us know if anything changes.` },
    { id: 'on_the_way', title: 'On our way', body: 'Hi [customer], we’re on our way from [business]. We expect to arrive at [time]. See you soon!' },
    { id: 'running_late', title: 'Running late', body: 'Hi [customer], apologies—we’re running slightly late. Our updated arrival time is [time]. Thank you for your patience. — [business]' },
    { id: 'thank_you', title: 'Thank you & review', body: 'Hi [customer], thank you for choosing [business]! We’d appreciate an honest Google review of your experience. It helps other customers find us:\n[review_link]\n\nThanks, [business]' },
  ];
}

export function getTemplates(saved: unknown, mobileCarWash = false): WhatsAppTemplate[] {
  const parsed = TemplatesSchema.safeParse(saved);
  return parsed.success ? TEMPLATE_IDS.map((id) => parsed.data.find((t) => t.id === id)!) : defaultTemplates(mobileCarWash);
}

export function renderTemplate(body: string, context: { customer: string; business: string; reviewLink?: string | null }): string {
  const replacements: Record<string, string> = {
    customer: context.customer.trim() || 'there', business: context.business,
    review_link: context.reviewLink?.trim() || '[review_link]',
  };
  // Replace in one pass: names and business details must never be interpreted as template code.
  return body.replace(/\[(customer|business|review_link)\]/g, (match, token: string) => replacements[token] ?? match);
}

export function unresolvedTokens(message: string): string[] {
  return [...new Set([...message.matchAll(/\[([a-z_]+)\]/gi)].map((m) => m[0]))];
}

export function whatsAppMessageUrl(phone: string | null, message: string): string | null {
  if (!phone || !message.trim() || unresolvedTokens(message).length) return null;
  const normalized = normalizeSaPhone(phone).replace(/[\s()-]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(normalized)) return null;
  return `https://wa.me/${normalized.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`;
}

export function templateSetup(tenant: { whatsappTemplates: unknown; googleReviewUrl: string | null; industry: string | null }, preset?: string) {
  const ecoDraft = preset === 'eco4wash' && tenant.whatsappTemplates == null && !tenant.googleReviewUrl;
  return {
    templates: getTemplates(tenant.whatsappTemplates, tenant.industry === 'MOBILE_CAR_WASH'),
    reviewUrl: ecoDraft ? ECO4_REVIEW_URL : tenant.googleReviewUrl ?? '',
    ecoDraft,
  };
}
