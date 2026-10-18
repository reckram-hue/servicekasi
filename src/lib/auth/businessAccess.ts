'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, requireSignedIn } from '@/lib/auth/session';
import { personLimit } from '@/lib/plans/plans';
import { pausedMembershipIds } from '@/lib/plans/people';

export type AccessState = { error?: string; ok?: string } | undefined;

const GrantSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  acknowledge: z.literal('on'),
});

export async function grantBusinessAccessAction(_: AccessState, formData: FormData): Promise<AccessState> {
  const { tenant, user } = await requireRole(['OWNER']);
  const parsed = GrantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Enter the helper’s login email and confirm administrator access.' };

  // Membership and audit changes commit together. Serializable isolation prevents
  // simultaneous grants from consuming the same remaining seat.
  let result: AccessState;
  try {
    result = await prisma.$transaction(async (tx) => {
      const helper = await tx.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, passwordHash: true } });
      if (!helper?.passwordHash) return { error: 'No email-login account found. Ask your helper to confirm their ServiceKasi login email.' };
      if (helper.id === user.id) return { error: 'You already own this business.' };
      const existing = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId: helper.id } } });
      if (existing?.active || (existing && existing.role !== 'ADMIN')) {
        return { error: 'This person already has a team membership. Their role has not been changed.' };
      }
      const currentTenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
      const limit = personLimit(currentTenant);
      const used = await tx.membership.count({ where: { tenantId: tenant.id, active: true } });
      if (limit != null && used >= limit) return { error: 'Your package has no spare seats. Choose a larger package before adding a helper.' };
      const membership = existing
        ? await tx.membership.update({ where: { id: existing.id }, data: { active: true, doesFieldwork: false } })
        : await tx.membership.create({ data: { tenantId: tenant.id, userId: helper.id, role: 'ADMIN' } });
      await tx.auditLog.create({ data: {
        tenantId: tenant.id, userId: user.id, action: 'access.granted', entityType: 'Membership', entityId: membership.id,
        details: { helperUserId: helper.id, email: parsed.data.email, role: 'ADMIN' },
      } });
      return { ok: 'Access granted. Your helper can sign in with their own account and choose this business under Switch business.' };
    }, { isolationLevel: 'Serializable' });
  } catch {
    return { error: 'Could not grant access. Refresh the page and try again.' };
  }
  revalidatePath('/settings/access');
  revalidatePath('/team');
  revalidatePath('/switch-business');
  return result;
}

export async function revokeBusinessAccessAction(_: AccessState, formData: FormData): Promise<AccessState> {
  const { tenant, user } = await requireRole(['OWNER']);
  const membershipId = String(formData.get('membershipId') ?? '');
  let result: AccessState;
  try {
    result = await prisma.$transaction(async (tx) => {
      const helper = await tx.membership.findFirst({ where: { id: membershipId, tenantId: tenant.id, role: 'ADMIN', active: true }, include: { user: { select: { email: true } } } });
      if (!helper || helper.userId === user.id) return { error: 'Active helper access was not found in this business.' };
      await tx.membership.update({ where: { id: helper.id }, data: { active: false, doesFieldwork: false } });
      // Keep their login and other businesses intact; their next request must
      // choose another business. requireAuth also checks active membership.
      await tx.session.updateMany({ where: { userId: helper.userId, activeTenantId: tenant.id }, data: { activeTenantId: null } });
      await tx.auditLog.create({ data: {
        tenantId: tenant.id, userId: user.id, action: 'access.revoked', entityType: 'Membership', entityId: helper.id,
        details: { helperUserId: helper.userId, email: helper.user.email },
      } });
      return { ok: 'Access revoked. This helper can no longer open or change this business.' };
    }, { isolationLevel: 'Serializable' });
  } catch {
    return { error: 'Could not revoke access. Refresh the page and try again.' };
  }
  revalidatePath('/settings/access');
  revalidatePath('/team');
  revalidatePath('/switch-business');
  return result;
}

export async function switchBusinessAction(_: AccessState, formData: FormData): Promise<AccessState> {
  const session = await requireSignedIn();
  const tenantId = String(formData.get('tenantId') ?? '');
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId: session.userId } }, include: { tenant: true },
  });
  if (!membership?.active) return { error: 'You no longer have access to this business.' };
  if ((await pausedMembershipIds(membership.tenant)).has(membership.id)) {
    return { error: 'Your seat in this business is paused. Ask the owner to check their package.' };
  }
  const updated = await prisma.session.updateMany({
    where: { id: session.id, userId: session.userId, mfaPending: false, expiresAt: { gt: new Date() } },
    data: { activeTenantId: tenantId },
  });
  if (!updated.count) redirect('/login');
  revalidatePath('/', 'layout');
  redirect('/');
}
