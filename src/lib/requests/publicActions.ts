'use server';

import { prisma } from '@/lib/prisma';
import { normalizeSaPhone } from '@/lib/southAfrica';

export type PublicFormState = { error?: string; ok?: boolean } | undefined;

const NAME_MAX = 100;
const PHONE_MAX = 30;
const DESCRIPTION_MAX = 2000;

/**
 * Creates a lead from the public /book/<slug> page (docs/plans/onboarding.md).
 * No session exists here — the slug is a stable, publicly-advertised value
 * (unlike a quote/invoice's unguessable token), so this is more exposed to
 * spam than the rest of the app's public pages. The hidden "website" field
 * is a honeypot: a real visitor never fills it in, so anything present there
 * is treated as a bot and quietly accepted without creating a row, rather
 * than telling the bot its submission was rejected.
 */
export async function submitServiceRequestAction(_: PublicFormState, formData: FormData): Promise<PublicFormState> {
  if (String(formData.get('website') ?? '').trim()) return { ok: true };

  const slug = String(formData.get('slug') ?? '').trim();
  if (!slug) return { error: 'Something went wrong. Please reload the page and try again.' };

  const contactName = String(formData.get('contactName') ?? '').trim();
  const contactPhone = String(formData.get('contactPhone') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const preferredDateRaw = String(formData.get('preferredDate') ?? '').trim();

  if (contactName.length < 2) return { error: 'Please enter your name.' };
  if (contactName.length > NAME_MAX) return { error: `Please keep your name under ${NAME_MAX} characters.` };
  if (!contactPhone) return { error: 'Please enter a phone number so the business can reach you.' };
  if (contactPhone.length > PHONE_MAX) return { error: 'Please enter a valid phone number.' };
  if (description.length < 5) return { error: 'Please describe what you need a bit more.' };
  if (description.length > DESCRIPTION_MAX) return { error: `Please keep your message under ${DESCRIPTION_MAX} characters.` };

  let preferredDate: Date | undefined;
  if (preferredDateRaw) {
    const parsed = new Date(`${preferredDateRaw}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) preferredDate = parsed;
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return { error: 'This booking page could not be found.' };

  await prisma.serviceRequest.create({
    data: {
      tenantId: tenant.id,
      source: 'WEB_BOOKING',
      contactName,
      contactPhone: normalizeSaPhone(contactPhone),
      description,
      preferredDate,
    },
  });

  return { ok: true };
}
