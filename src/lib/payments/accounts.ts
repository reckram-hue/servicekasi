import 'server-only';
import type { PaymentAccount, PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/payments/secrets';
import { payfast } from '@/lib/payments/payfast';
import type { PaymentProvider, ProviderCredentials } from '@/lib/payments/types';

export const PROVIDERS: Partial<Record<PaymentMethod, { label: string; provider: PaymentProvider; currencies: string[] }>> = {
  PAYFAST: { label: 'PayFast', provider: payfast, currencies: ['ZAR'] },
};

type StoredSecrets = { merchantKey: string; passphrase: string };

/**
 * The account's credentials, or null when the stored secrets can't be
 * decrypted (PAYMENT_SECRETS_KEY missing or changed since they were saved).
 * Callers then treat online payment as unavailable until they're re-entered.
 */
export function readCredentials(account: PaymentAccount): ProviderCredentials | null {
  try {
    const secrets = JSON.parse(decryptSecret(account.secretsEnc)) as StoredSecrets;
    return { merchantId: account.merchantId, merchantKey: secrets.merchantKey, passphrase: secrets.passphrase, sandbox: account.sandbox };
  } catch {
    return null;
  }
}

/** The business's switched-on, usable provider account that can take this currency, if any. */
export async function activePaymentAccount(tenantId: string, currencyCode: string): Promise<PaymentAccount | null> {
  const accounts = await prisma.paymentAccount.findMany({ where: { tenantId, enabled: true } });
  return accounts.find((a) => PROVIDERS[a.provider]?.currencies.includes(currencyCode) && readCredentials(a)) ?? null;
}
