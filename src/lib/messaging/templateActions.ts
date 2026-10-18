'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { ReviewUrlSchema, TEMPLATE_IDS, TemplatesSchema } from './templates';

export type TemplateSaveState = { error?: string; ok?: string } | undefined;

export async function saveWhatsAppTemplatesAction(_: TemplateSaveState, data: FormData): Promise<TemplateSaveState> {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const parsed = TemplatesSchema.safeParse(TEMPLATE_IDS.map((id) => ({ id, title: data.get(`${id}_title`), body: data.get(`${id}_body`) })));
  const review = ReviewUrlSchema.safeParse(data.get('reviewUrl'));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check all four templates.' };
  if (!review.success) return { error: 'Enter a valid http or https review link, or leave it blank.' };
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { whatsappTemplates: parsed.data, googleReviewUrl: review.data || null },
  });
  revalidatePath('/messages');
  revalidatePath('/messages/templates');
  revalidatePath('/clients', 'layout');
  revalidatePath('/settings/business');
  return { ok: 'Your four templates and review link are saved for this business.' };
}
