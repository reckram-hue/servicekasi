import { requireRole } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { readCredentials } from '@/lib/payments/accounts';
import { PayFastSettingsForm } from '@/components/payments/PayFastSettingsForm';

export default async function PaymentSettingsPage() {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const account = await prisma.paymentAccount.findUnique({ where: { tenantId_provider: { tenantId: tenant.id, provider: 'PAYFAST' } } });
  const creds = account ? readCredentials(account) : null;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-2xl font-bold">Online payments</h1>
        <p className="mb-6 text-sm text-slate-400">
          Add a &quot;Pay now&quot; button to your invoices. Payments are recorded on the invoice automatically once the provider confirms them.
        </p>
        {tenant.currencyCode !== 'ZAR' ? (
          <p className="rounded-lg bg-slate-800/50 px-3 py-2 text-sm text-slate-400">
            PayFast only takes payments in rand. More providers are coming.
          </p>
        ) : (
          <>
            {account && !creds && (
              <p className="mb-4 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                Your saved PayFast key and passphrase can&apos;t be read on this server (its encryption key has changed), so clients can&apos;t pay
                online right now. Enter your merchant key and passphrase again and save.
              </p>
            )}
            <PayFastSettingsForm
              account={
                account
                  ? {
                      enabled: account.enabled,
                      sandbox: account.sandbox,
                      merchantId: account.merchantId,
                      secretsReadable: !!creds,
                      passphraseSet: !!creds?.passphrase,
                    }
                  : null
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
