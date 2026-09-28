'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export type PublicFormState = { error?: string; ok?: boolean } | undefined;

const TokenSchema = z.string().uuid();

export async function unsubscribeAction(_: PublicFormState, formData: FormData): Promise<PublicFormState> {
  const token = TokenSchema.safeParse(formData.get('token'));
  if (!token.success) return { error: 'Invalid link.' };

  const client = await prisma.client.findUnique({ where: { unsubscribeToken: token.data }, select: { id: true } });
  if (!client) return { error: 'This link is no longer valid.' };

  await prisma.client.update({
    where: { id: client.id },
    data: { marketingOptOutAt: new Date(), marketingOptOutSource: 'email_link' },
  });

  return { ok: true };
}

export async function undoUnsubscribeAction(_: PublicFormState, formData: FormData): Promise<PublicFormState> {
  const token = TokenSchema.safeParse(formData.get('token'));
  if (!token.success) return { error: 'Invalid link.' };

  const client = await prisma.client.findUnique({ where: { unsubscribeToken: token.data }, select: { id: true } });
  if (!client) return { error: 'This link is no longer valid.' };

  await prisma.client.update({
    where: { id: client.id },
    data: { marketingOptOutAt: null, marketingOptOutSource: null },
  });

  return { ok: true };
}
