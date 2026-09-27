'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth/session';
import { canUse, minimumPlanFor, PLAN_LABEL } from '@/lib/plans/plans';
import { encryptSecret } from '@/lib/payments/secrets';
import { readCredentials } from '@/lib/payments/accounts';
import { startOnlinePayment } from '@/lib/payments/online';
import type { CheckoutForm } from '@/lib/payments/types';

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; ok?: string } | undefined;

async function baseUrl(): Promise<string> {
  const configured = process.env.PUBLIC_APP_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const protocol = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

/** Public (no login): the client's "Pay now". Returns the signed checkout form to submit. */
export async function startOnlinePaymentAction(publicToken: string): Promise<{ error: string } | CheckoutForm> {
  if (!z.string().uuid().safeParse(publicToken).success) return { error: 'This invoice can’t be paid online.' };
  return startOnlinePayment(publicToken, await baseUrl());
}

const PayFastSchema = z.object({
  enabled: z.literal('on').optional(),
  sandbox: z.literal('on').optional(),
  merchantId: z.string().trim().regex(/^\d{5,12}$/, { error: 'Your PayFast merchant ID is a number, e.g. 10000100.' }),
  merchantKey: z.string().trim().regex(/^[A-Za-z0-9]{0,40}$/, { error: 'Letters and numbers only.' }),
  passphrase: z.string().trim().max(100).regex(/^[^\s]*$/, { error: 'No spaces.' }).optional(),
  clearPassphrase: z.literal('on').optional(),
});

/** Saves the business's own PayFast account. Blank key/passphrase keeps what's stored. */
export async function savePayFastAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant, user } = await requireRole(['OWNER', 'ADMIN']);
  if (!user.totpEnabled) return { error: 'Switch on your authenticator app (Settings → Security) before connecting online payments.' };
  const parsed = PayFastSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  if (d.enabled && !canUse(tenant, 'onlinePayments')) {
    return { error: `Online payments need the ${PLAN_LABEL[minimumPlanFor('onlinePayments')]} package or higher. Upgrade under Settings → Package.` };
  }

  const existing = await prisma.paymentAccount.findUnique({ where: { tenantId_provider: { tenantId: tenant.id, provider: 'PAYFAST' } } });
  // Unreadable old secrets (encryption key changed) are simply replaced by what's typed now.
  const old = existing ? readCredentials(existing) : null;
  const merchantKey = d.merchantKey || old?.merchantKey || '';
  if (!merchantKey) return { fieldErrors: { merchantKey: ['Enter your PayFast merchant key.'] } };
  const passphrase = d.clearPassphrase ? '' : d.passphrase || old?.passphrase || '';
  if (!d.sandbox && d.enabled && !passphrase) {
    return { fieldErrors: { passphrase: ['Live payments need a passphrase. Set one in your PayFast dashboard (Settings → Developer settings) and enter it here.'] } };
  }

  const data = {
    enabled: !!d.enabled,
    sandbox: !!d.sandbox,
    merchantId: d.merchantId,
    secretsEnc: encryptSecret(JSON.stringify({ merchantKey, passphrase })),
  };
  await prisma.paymentAccount.upsert({
    where: { tenantId_provider: { tenantId: tenant.id, provider: 'PAYFAST' } },
    create: { tenantId: tenant.id, provider: 'PAYFAST', ...data },
    update: data,
  });
  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      action: 'payments.provider_saved',
      entityType: 'PaymentAccount',
      entityId: 'PAYFAST',
      // Never the key or passphrase.
      details: { enabled: data.enabled, sandbox: data.sandbox, merchantId: data.merchantId, passphraseSet: !!passphrase },
    },
  });

  revalidatePath('/settings/payments');
  return { ok: data.enabled ? `Saved. Clients can now pay online${data.sandbox ? ' (sandbox: test payments only, no real money)' : ''}.` : 'Saved. Online payment is switched off.' };
}
