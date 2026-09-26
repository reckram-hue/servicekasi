import type { PaymentMethod } from '@prisma/client';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  EFT: 'EFT',
  CARD: 'Card machine',
  PAYFAST: 'PayFast',
  YOCO: 'Yoco',
  OZOW: 'Ozow',
  PAYSTACK: 'Paystack',
  MOBILE_MONEY: 'Mobile money',
  OTHER: 'Other',
};

/** Methods an owner can pick when recording a payment by hand. Provider methods (PayFast, Yoco…) are set by their own integration, not this list. */
export const MANUAL_PAYMENT_METHODS = ['EFT', 'CASH', 'CARD', 'OTHER'] as const satisfies readonly PaymentMethod[];
