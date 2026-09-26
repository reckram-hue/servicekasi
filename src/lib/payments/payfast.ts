import 'server-only';
import { createHash } from 'crypto';
import type { CheckoutForm, CheckoutRequest, PaymentProvider, ProviderCredentials, VerifiedNotification } from '@/lib/payments/types';

const host = (sandbox: boolean) => (sandbox ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za');

/** PayFast's encoding: like PHP urlencode (uppercase hex, spaces as "+"). */
function encode(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%20/g, '+');
}

/** "key=value&…" over the pairs in the given order. Callers drop blank checkout fields; a callback's blanks are signed as sent. */
function paramString(pairs: [string, string][]): string {
  return pairs.map(([k, v]) => `${k}=${encode(v)}`).join('&');
}

/** MD5 of the param string, with the passphrase appended when the account has one. */
function signature(pairs: [string, string][], passphrase: string): string {
  const base = paramString(pairs) + (passphrase ? `&passphrase=${encode(passphrase)}` : '');
  return createHash('md5').update(base).digest('hex');
}

function centsFromAmount(amount: string | null): number | null {
  if (!amount || !/^-?\d+(\.\d{1,2})?$/.test(amount)) return null;
  const [whole, frac = ''] = amount.replace('-', '').split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return amount.startsWith('-') ? -cents : cents;
}

export const payfast: PaymentProvider = {
  checkoutForm(creds: ProviderCredentials, req: CheckoutRequest): CheckoutForm {
    // The order matters: PayFast signs its fields in this documented order.
    const pairs: [string, string][] = [
      ['merchant_id', creds.merchantId],
      ['merchant_key', creds.merchantKey],
      ['return_url', req.returnUrl],
      ['cancel_url', req.cancelUrl],
      ['notify_url', req.notifyUrl],
      ['m_payment_id', req.paymentId],
      ['amount', (req.amountCents / 100).toFixed(2)],
      ['item_name', req.itemName.slice(0, 100)],
    ];
    const fields = pairs.filter(([, v]) => v !== '');
    return { action: `${host(creds.sandbox)}/eng/process`, fields: [...fields, ['signature', signature(fields, creds.passphrase)]] };
  },

  paymentIdFromNotification(body: string): string | null {
    return new URLSearchParams(body).get('m_payment_id');
  },

  async verifyNotification(creds: ProviderCredentials, body: string): Promise<VerifiedNotification> {
    const params = new URLSearchParams(body);
    // Signed in the order PayFast sent them, everything except the signature itself.
    const pairs = [...params.entries()].filter(([k]) => k !== 'signature');
    if (signature(pairs, creds.passphrase) !== params.get('signature')) return { ok: false, reason: 'bad signature' };
    if (params.get('merchant_id') !== creds.merchantId) return { ok: false, reason: 'wrong merchant' };

    const paymentId = params.get('m_payment_id');
    const providerReference = params.get('pf_payment_id');
    const amountCents = centsFromAmount(params.get('amount_gross'));
    if (!paymentId || !providerReference || amountCents === null) return { ok: false, reason: 'missing fields' };

    // Ask PayFast's own server whether it really sent this.
    let confirmation: string;
    try {
      const res = await fetch(`${host(creds.sandbox)}/eng/query/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: paramString(pairs),
        signal: AbortSignal.timeout(10_000),
      });
      confirmation = (await res.text()).trim();
    } catch {
      return { ok: false, reason: 'could not reach PayFast to confirm' };
    }
    if (confirmation !== 'VALID') return { ok: false, reason: `PayFast said ${confirmation.slice(0, 40)}` };

    const status = params.get('payment_status') === 'COMPLETE' ? 'COMPLETE' : 'FAILED';
    return { ok: true, status, paymentId, providerReference, amountCents };
  },
};
