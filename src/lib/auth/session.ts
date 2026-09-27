import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { pausedMembershipIds } from '@/lib/plans/people';
import { newToken, sha256 } from './crypto';

export const SESSION_COOKIE = 'sk_session';

// Office staff: 7 days. Technicians stay logged in for 30 days so they aren't
// retyping a PIN on site every morning.
const OFFICE_DAYS = 7;
const TECHNICIAN_DAYS = 30;
const MFA_PENDING_MINUTES = 10;

export async function createSession(opts: {
  userId: string;
  tenantId: string | null;
  mfaPending?: boolean;
  longLived?: boolean;
}) {
  const token = newToken();
  const ms = opts.mfaPending
    ? MFA_PENDING_MINUTES * 60_000
    : (opts.longLived ? TECHNICIAN_DAYS : OFFICE_DAYS) * 86_400_000;
  const expiresAt = new Date(Date.now() + ms);

  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId: opts.userId,
      activeTenantId: opts.tenantId,
      mfaPending: opts.mfaPending ?? false,
      expiresAt,
      userAgent: (await headers()).get('user-agent')?.slice(0, 250),
    },
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/** Looks up the current device's session (including MFA-pending ones). */
export const getRawSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
});

export async function deleteCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  store.delete(SESSION_COOKIE);
}

/**
 * The signed-in person and the business they're working in. Redirects to
 * /login if not signed in. Use at the top of every protected page and action.
 */
export const requireAuth = cache(async () => {
  const session = await getRawSession();
  if (!session) redirect('/login');
  if (session.mfaPending) redirect('/login/verify');
  if (!session.activeTenantId) redirect('/login?error=no-business');

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: session.activeTenantId, userId: session.userId } },
    include: { tenant: true },
  });
  if (!membership || !membership.active) redirect('/login?error=no-access');
  if ((await pausedMembershipIds(membership.tenant)).has(membership.id)) {
    await deleteCurrentSession();
    redirect('/login?error=paused');
  }

  return { session, user: session.user, membership, tenant: membership.tenant };
});

const OFFICE_ROLES: Role[] = ['OWNER', 'ADMIN', 'DISPATCHER'];

/** Like requireAuth, but also checks the person's role in this business. */
export async function requireRole(allowed: Role[] = OFFICE_ROLES) {
  const auth = await requireAuth();
  if (!allowed.includes(auth.membership.role)) redirect('/');
  return auth;
}
