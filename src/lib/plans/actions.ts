'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth/session';

/** Owner has seen the "your trial has ended" screen — don't show it again. */
export async function acknowledgeTrialEndAction() {
  const { tenant } = await requireRole(['OWNER']);
  if (!tenant.trialEndScreenShownAt) {
    await prisma.tenant.update({ where: { id: tenant.id }, data: { trialEndScreenShownAt: new Date() } });
  }
  redirect('/');
}
