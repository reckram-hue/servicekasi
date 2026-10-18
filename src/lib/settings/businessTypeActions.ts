'use server';

import { Industry } from '@prisma/client';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export type BusinessTypeState = { error?: string; ok?: string } | undefined;

export async function updateBusinessTypeAction(_: BusinessTypeState, formData: FormData): Promise<BusinessTypeState> {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const parsed = z.enum(Industry).safeParse(formData.get('industry'));
  if (!parsed.success) return { error: 'Choose a business type.' };
  await prisma.tenant.update({ where: { id: tenant.id }, data: { industry: parsed.data } });
  revalidatePath('/', 'layout');
  revalidatePath(`/book/${tenant.slug}`);
  return { ok: 'Business type saved. Your existing services and prices are unchanged. Add starter services from your price list if you need them.' };
}
