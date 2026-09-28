'use server';

import { revalidatePath } from 'next/cache';
import type { PlanTier } from '@prisma/client';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

const PLANS: PlanTier[] = ['FREE_SOLO', 'TEAM', 'GROWTH'];

export async function setTenantPlanAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const tenantId = String(formData.get('tenantId') ?? '');
  const plan = String(formData.get('plan') ?? '');
  if (!PLANS.includes(plan as PlanTier)) return;

  await prisma.tenant.update({ where: { id: tenantId }, data: { plan: plan as PlanTier, subscriptionStatus: 'ACTIVE' } });
  revalidatePath('/admin/tenants');
}

/** Marks a business as a beta tester (full Growth package, free) or takes that status back. */
export async function toggleTenantBetaAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const tenantId = String(formData.get('tenantId') ?? '');
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: tenant.isBeta ? { isBeta: false } : { isBeta: true, plan: 'GROWTH', subscriptionStatus: 'ACTIVE' },
  });
  revalidatePath('/admin/tenants');
}

const MAX_EXTEND_DAYS = 365;

export async function extendTenantTrialAction(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const tenantId = String(formData.get('tenantId') ?? '');
  const days = Math.min(Math.max(Number(formData.get('days') ?? 0), 1), MAX_EXTEND_DAYS);
  if (!Number.isFinite(days) || days < 1) return;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { subscriptionStatus: 'TRIALING', trialEndsAt: new Date(Date.now() + days * 86_400_000), trialEndScreenShownAt: null },
  });
  revalidatePath('/admin/tenants');
}
