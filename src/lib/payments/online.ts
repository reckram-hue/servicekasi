import 'server-only';
import { prisma } from '@/lib/prisma';
import { invoiceBalanceCents, lockInvoice, recalcInvoiceBalance } from '@/lib/invoices/payments';
import { activePaymentAccount, readCredentials, PROVIDERS } from '@/lib/payments/accounts';
import type { CheckoutForm } from '@/lib/payments/types';

/** A checkout started this recently for the same amount is reused, so repeated clicks don't pile up pending payments. */
const REUSE_PENDING_MS = 60 * 60 * 1000;

/**
 * "Pay now" on the client's invoice page: a pending payment for what's owed,
 * and the signed form that sends the client to the provider's checkout.
 * Nothing is recorded as paid until the provider confirms it (see
 * handleProviderNotification).
 */
export async function startOnlinePayment(publicToken: string, baseUrl: string): Promise<{ error: string } | CheckoutForm> {
  const invoice = await prisma.invoice.findUnique({
    where: { publicToken },
    select: {
      id: true, tenantId: true, number: true, kind: true, status: true, currencyCode: true,
      totalCents: true, creditedCents: true, paidCents: true,
      tenant: { select: { businessName: true, tradingName: true } },
    },
  });
  if (!invoice || !invoice.number || invoice.kind === 'CREDIT_NOTE' || invoice.status === 'DRAFT' || invoice.status === 'VOID') {
    return { error: 'This invoice can’t be paid online.' };
  }
  const balanceCents = invoiceBalanceCents(invoice);
  if (balanceCents <= 0) return { error: 'Nothing is owed on this invoice.' };

  const account = await activePaymentAccount(invoice.tenantId, invoice.currencyCode);
  const entry = account && PROVIDERS[account.provider];
  const creds = account && readCredentials(account);
  if (!account || !entry || !creds) return { error: 'Online payment isn’t available for this invoice. Please pay by EFT.' };

  const recent = await prisma.payment.findFirst({
    where: {
      invoiceId: invoice.id, method: account.provider, status: 'PENDING', amountCents: balanceCents,
      createdAt: { gt: new Date(Date.now() - REUSE_PENDING_MS) },
    },
    orderBy: { createdAt: 'desc' },
  });
  const payment =
    recent ??
    (await prisma.payment.create({
      data: { tenantId: invoice.tenantId, invoiceId: invoice.id, method: account.provider, status: 'PENDING', amountCents: balanceCents },
    }));

  const pageUrl = `${baseUrl}/i/${publicToken}`;
  return entry.provider.checkoutForm(creds, {
    paymentId: payment.id,
    amountCents: balanceCents,
    itemName: `Invoice ${invoice.number} from ${invoice.tenant.tradingName || invoice.tenant.businessName}`,
    returnUrl: `${pageUrl}?paid=1`,
    cancelUrl: pageUrl,
    notifyUrl: `${baseUrl}/api/payments/${account.provider.toLowerCase()}/notify`,
  });
}

/**
 * The provider's server-to-server confirmation. Verified (signature,
 * merchant, provider's own server, amount) before anything is recorded, and
 * recorded once only, however many times the provider sends it.
 * Returns a short reason for the log; never throws for a bad notification.
 */
export async function handleProviderNotification(providerName: string, body: string): Promise<{ ok: boolean; reason: string }> {
  const method = providerName.toUpperCase() as keyof typeof PROVIDERS;
  const entry = PROVIDERS[method];
  if (!entry) return { ok: false, reason: 'unknown provider' };

  const paymentId = entry.provider.paymentIdFromNotification(body);
  if (!paymentId || !/^[0-9a-f-]{36}$/i.test(paymentId)) return { ok: false, reason: 'no payment id' };
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.method !== method) return { ok: false, reason: 'unknown payment' };

  const account = await prisma.paymentAccount.findUnique({ where: { tenantId_provider: { tenantId: payment.tenantId, provider: method } } });
  if (!account) return { ok: false, reason: 'no provider account' };

  const creds = readCredentials(account);
  if (!creds) return { ok: false, reason: 'saved provider details can’t be decrypted (PAYMENT_SECRETS_KEY changed?)' };
  const verified = await entry.provider.verifyNotification(creds, body);
  if (!verified.ok) return { ok: false, reason: verified.reason };
  if (verified.paymentId !== payment.id) return { ok: false, reason: 'payment id mismatch' };

  if (verified.status !== 'COMPLETE') {
    await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED' } });
    return { ok: true, reason: 'not completed' };
  }
  if (verified.amountCents !== payment.amountCents) return { ok: false, reason: `amount ${verified.amountCents} ≠ expected ${payment.amountCents}` };

  return prisma.$transaction(async (tx) => {
    await lockInvoice(tx, payment.tenantId, payment.invoiceId);
    // The provider's own reference identifies a payment: the same one sent twice is recorded once.
    const seen = await tx.payment.findFirst({ where: { method, providerReference: verified.providerReference } });
    if (seen) return { ok: true, reason: 'already recorded' };

    const fresh = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    let recordedId = payment.id;
    if (fresh.status === 'SUCCEEDED') {
      // A second, separate payment on the same checkout (e.g. paid in two browser tabs). The money
      // arrived, so it's recorded too; the invoice then shows the overpayment as a refund due.
      const second = await tx.payment.create({
        data: {
          tenantId: payment.tenantId, invoiceId: payment.invoiceId, method, status: 'SUCCEEDED',
          amountCents: verified.amountCents, providerReference: verified.providerReference, receivedAt: new Date(),
        },
      });
      recordedId = second.id;
    } else {
      await tx.payment.update({
        where: { id: payment.id },
        // A payment the client abandoned and then completed later still counts: the money arrived.
        data: { status: 'SUCCEEDED', providerReference: verified.providerReference, receivedAt: new Date() },
      });
    }
    await recalcInvoiceBalance(tx, payment.invoiceId);
    await tx.auditLog.create({
      data: {
        tenantId: payment.tenantId,
        action: 'payment.received_online',
        entityType: 'Invoice',
        entityId: payment.invoiceId,
        details: { paymentId: recordedId, provider: method, providerReference: verified.providerReference, amountCents: verified.amountCents },
      },
    });
    return { ok: true, reason: 'recorded' };
  });
}
