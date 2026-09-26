/**
 * What every online payment provider (PayFast now; Ozow, Yoco later) must do.
 * Invoices only ever talk to this interface, so adding a provider never
 * touches invoice code.
 */
export type ProviderCredentials = {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
};

export type CheckoutRequest = {
  /** Our Payment id: the provider sends it back so we know which payment it is. */
  paymentId: string;
  amountCents: number;
  itemName: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
};

/** A browser form POST to the provider's hosted checkout. */
export type CheckoutForm = { action: string; fields: [string, string][] };

export type VerifiedNotification =
  | { ok: true; status: 'COMPLETE' | 'FAILED'; paymentId: string; providerReference: string; amountCents: number }
  | { ok: false; reason: string };

export interface PaymentProvider {
  checkoutForm(creds: ProviderCredentials, req: CheckoutRequest): CheckoutForm;
  /** Reads the provider's callback. Only its own id is trusted before the signature is checked. */
  paymentIdFromNotification(body: string): string | null;
  /** Checks signature, merchant and (with the provider's server) that the notification is genuine. */
  verifyNotification(creds: ProviderCredentials, body: string): Promise<VerifiedNotification>;
}
