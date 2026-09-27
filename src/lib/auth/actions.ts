'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Industry, type User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeSaPhone } from '@/lib/southAfrica';
import { starterItemRows } from '@/lib/onboarding/starterPriceList';
import { hashSecret, verifySecret } from './crypto';
import { generateTotpSecret, verifyTotp } from './totp';
import { createSession, deleteCurrentSession, getRawSession, requireAuth, requireRole } from './session';

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; ok?: string } | undefined;

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const GENERIC_LOGIN_ERROR = 'Those details are not correct.';

// ───────────────────────── helpers ─────────────────────────

function isLocked(user: Pick<User, 'lockedUntil'> | null) {
  return !!user?.lockedUntil && user.lockedUntil > new Date();
}

async function recordFailure(user: User | null) {
  if (!user) return;
  const count = user.failedLoginCount + 1;
  await prisma.user.update({
    where: { id: user.id },
    data:
      count >= MAX_ATTEMPTS
        ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
        : { failedLoginCount: count },
  });
}

async function clearFailures(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: null } });
}

async function firstActiveTenantId(userId: string) {
  const m = await prisma.membership.findFirst({
    where: { userId, active: true },
    orderBy: { createdAt: 'asc' },
  });
  return m?.tenantId ?? null;
}

function toE164(phone: string) {
  const normalized = normalizeSaPhone(phone.trim());
  return /^\+\d{9,15}$/.test(normalized) ? normalized : null;
}

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'business';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

const password = z
  .string()
  .min(10, { error: 'Use at least 10 characters.' })
  .max(200);

const pin = z.string().regex(/^\d{4,6}$/, { error: 'PIN must be 4 to 6 digits.' });

// ───────────────────────── owner sign-up ─────────────────────────

const SignupSchema = z.object({
  businessName: z.string().trim().min(2, { error: 'Enter your business name.' }),
  name: z.string().trim().min(2, { error: 'Enter your name.' }),
  email: z.email({ error: 'Enter a valid email address.' }).trim().toLowerCase(),
  password,
  industry: z.enum(Industry, { error: 'Choose your trade.' }),
});

export async function signupAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { businessName, name, email, industry } = parsed.data;

  if (await prisma.user.findUnique({ where: { email } })) {
    return { fieldErrors: { email: ['An account with this email already exists. Log in instead.'] } };
  }

  const passwordHash = await hashSecret(parsed.data.password);
  const tenant = await prisma.tenant.create({
    data: {
      businessName,
      slug: slugify(businessName),
      industry,
      trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
      catalogItems: { createMany: { data: starterItemRows(industry) } },
      memberships: {
        create: { role: 'OWNER', user: { create: { name, email, passwordHash } } },
      },
    },
    include: { memberships: true },
  });

  await createSession({ userId: tenant.memberships[0].userId, tenantId: tenant.id });
  // Owners are asked to set up the authenticator app first (they may skip for now).
  redirect('/settings/security');
}

// ───────────────────────── owner / office login ─────────────────────────

const EmailLoginSchema = z.object({
  email: z.email({ error: 'Enter a valid email address.' }).trim().toLowerCase(),
  password: z.string().min(1, { error: 'Enter your password.' }),
});

export async function emailLoginAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = EmailLoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (isLocked(user)) return { error: `Too many attempts. Try again in ${LOCK_MINUTES} minutes.` };

  const ok = await verifySecret(parsed.data.password, user?.passwordHash);
  if (!ok || !user) {
    await recordFailure(user);
    return { error: GENERIC_LOGIN_ERROR };
  }

  await clearFailures(user.id);
  await createSession({
    userId: user.id,
    tenantId: await firstActiveTenantId(user.id),
    mfaPending: user.totpEnabled,
  });
  redirect(user.totpEnabled ? '/login/verify' : '/');
}

// ───────────────────────── technician login ─────────────────────────

const PinLoginSchema = z.object({
  phone: z.string().trim().min(9, { error: 'Enter your cellphone number.' }),
  pin: z.string().trim().min(1, { error: 'Enter your PIN.' }),
});

export async function pinLoginAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = PinLoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const phone = toE164(parsed.data.phone);
  const user = phone ? await prisma.user.findUnique({ where: { phone } }) : null;
  if (isLocked(user)) {
    return { error: `Too many attempts. Try again in ${LOCK_MINUTES} minutes, or ask your manager to reset your PIN.` };
  }

  const ok = await verifySecret(parsed.data.pin, user?.pinHash);
  if (!ok || !user) {
    await recordFailure(user);
    return { error: GENERIC_LOGIN_ERROR };
  }

  await clearFailures(user.id);
  await createSession({ userId: user.id, tenantId: await firstActiveTenantId(user.id), longLived: true });
  redirect('/');
}

// ───────────────────────── authenticator step ─────────────────────────

export async function verifyTotpAction(_: FormState, formData: FormData): Promise<FormState> {
  const session = await getRawSession();
  if (!session?.mfaPending) redirect('/login');
  const user = session.user;
  if (isLocked(user)) return { error: `Too many attempts. Try again in ${LOCK_MINUTES} minutes.` };

  const step = user.totpSecret
    ? verifyTotp(user.totpSecret, String(formData.get('code') ?? ''), user.totpLastUsedStep)
    : null;
  if (step == null) {
    await recordFailure(user);
    return { error: 'That code is not correct. Check the latest code in your authenticator app.' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpLastUsedStep: step, failedLoginCount: 0, lockedUntil: null },
  });
  await deleteCurrentSession();
  await createSession({ userId: user.id, tenantId: session.activeTenantId });
  redirect('/');
}

// ───────────────────────── authenticator setup ─────────────────────────

/** Creates (or re-uses) an unconfirmed secret for the QR code. */
export async function ensureTotpSetupSecret() {
  const { user } = await requireAuth();
  if (user.totpEnabled) return null;
  if (user.totpSecret) return user.totpSecret;
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
  return secret;
}

export async function confirmTotpSetupAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAuth();
  if (user.totpEnabled || !user.totpSecret) redirect('/');

  const step = verifyTotp(user.totpSecret, String(formData.get('code') ?? ''));
  if (step == null) {
    return { error: 'That code did not match. Make sure you scanned the QR code, then type the newest 6-digit code.' };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpLastUsedStep: step },
  });
  redirect('/');
}

/** Owner chose "Skip for now". Recorded with a date so there's a trail that they declined. */
export async function skipTotpSetupAction() {
  const { user, tenant } = await requireAuth();
  if (user.totpEnabled) redirect('/');
  if (!user.totpSkippedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { totpSkippedAt: new Date() } });
    await prisma.auditLog.create({
      data: { tenantId: tenant.id, userId: user.id, action: 'security.authenticator_skipped', entityType: 'User', entityId: user.id },
    });
  }
  redirect('/');
}

// ───────────────────────── logout ─────────────────────────

export async function logoutAction() {
  await deleteCurrentSession();
  redirect('/login');
}

// ───────────────────────── team: technicians ─────────────────────────

const AddTechnicianSchema = z.object({
  name: z.string().trim().min(2, { error: 'Enter their name.' }),
  phone: z.string().trim().min(9, { error: 'Enter their cellphone number.' }),
  pin,
  preferredLanguage: z.string().trim().min(2).max(5).default('en'),
});

export async function addTechnicianAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const parsed = AddTechnicianSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const phone = toE164(parsed.data.phone);
  if (!phone) return { fieldErrors: { phone: ['Enter a valid cellphone number, e.g. 082 123 4567.'] } };

  const existing = await prisma.user.findUnique({ where: { phone }, include: { memberships: true } });
  if (existing?.memberships.some((m) => m.tenantId === tenant.id)) {
    return { fieldErrors: { phone: ['This person is already on your team.'] } };
  }

  if (existing) {
    // They already work for another business on ServiceKasi — keep their own
    // PIN rather than letting this business overwrite it.
    await prisma.membership.create({ data: { tenantId: tenant.id, userId: existing.id, role: 'TECHNICIAN' } });
    revalidatePath('/team');
    return { ok: `${existing.name} added. They already have a ServiceKasi PIN, so they should keep using it.` };
  }

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      phone,
      preferredLanguage: parsed.data.preferredLanguage,
      pinHash: await hashSecret(parsed.data.pin),
      memberships: { create: { tenantId: tenant.id, role: 'TECHNICIAN' } },
    },
  });
  revalidatePath('/team');
  return { ok: `${parsed.data.name} added. They can log in with ${phone} and the PIN you chose.` };
}

export async function resetPinAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const newPin = pin.safeParse(String(formData.get('pin') ?? ''));
  if (!newPin.success) return { error: 'PIN must be 4 to 6 digits.' };

  const membership = await prisma.membership.findFirst({
    where: { id: String(formData.get('membershipId') ?? ''), tenantId: tenant.id },
    include: { user: { include: { memberships: true } } },
  });
  if (!membership) return { error: 'Team member not found.' };
  if (membership.user.memberships.some((m) => m.tenantId !== tenant.id)) {
    return { error: 'This person also works for another business, so only they can change their PIN.' };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: membership.userId },
      data: { pinHash: await hashSecret(newPin.data), failedLoginCount: 0, lockedUntil: null },
    }),
    // Log them out everywhere so the old PIN's sessions stop working.
    prisma.session.deleteMany({ where: { userId: membership.userId } }),
  ]);
  revalidatePath('/team');
  return { ok: `PIN reset for ${membership.user.name}.` };
}
