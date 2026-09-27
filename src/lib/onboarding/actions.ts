'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth/session';

export async function hideOnboardingChecklistAction() {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  await prisma.tenant.update({ where: { id: tenant.id }, data: { onboardingHiddenAt: new Date() } });
  revalidatePath('/');
  revalidatePath('/getting-started');
}

export async function showOnboardingChecklistAction() {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  await prisma.tenant.update({ where: { id: tenant.id }, data: { onboardingHiddenAt: null } });
  revalidatePath('/');
  redirect('/');
}
