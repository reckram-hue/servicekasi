'use client';

import { useActionState } from 'react';
import { savePayFastAction, type FormState } from '@/lib/payments/actions';
import { Checkbox, Field, FormMessage, SubmitButton } from '@/components/auth/ui';

export function PayFastSettingsForm({
  account,
}: {
  account: { enabled: boolean; sandbox: boolean; merchantId: string; secretsReadable: boolean; passphraseSet: boolean } | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePayFastAction, undefined);
  const e = state?.fieldErrors;

  return (
    <form action={action} className="rounded-xl border border-slate-800 p-4">
      <h2 className="mb-1 text-lg font-semibold">PayFast</h2>
      <p className="mb-4 text-sm text-slate-400">
        Clients pay by card, Instant EFT, Capitec Pay or SnapScan, straight into your own PayFast account. PayFast&apos;s fee comes off your payout;
        clients pay the invoice amount. Find these details in your PayFast dashboard under Settings → Developer settings.
      </p>
      <FormMessage error={state?.error} ok={state?.ok} />
      <Field label="Merchant ID" name="merchantId" inputMode="numeric" defaultValue={account?.merchantId ?? ''} errors={e?.merchantId} />
      <Field
        label="Merchant key"
        name="merchantKey"
        type="password"
        autoComplete="off"
        placeholder={account?.secretsReadable ? 'Saved (leave blank to keep)' : ''}
        errors={e?.merchantKey}
      />
      <Field
        label="Passphrase"
        name="passphrase"
        type="password"
        autoComplete="off"
        placeholder={account?.passphraseSet ? 'Saved (leave blank to keep)' : 'Optional in the sandbox, required for live payments'}
        errors={e?.passphrase}
      />
      {account?.passphraseSet && <Checkbox label="Remove the saved passphrase" name="clearPassphrase" />}
      <Checkbox label="Sandbox (test payments only, no real money)" name="sandbox" defaultChecked={account?.sandbox ?? true} />
      <Checkbox label="Let clients pay invoices online" name="enabled" defaultChecked={account?.enabled ?? false} />
      <p className="mb-4 text-xs text-slate-500">Your key and passphrase are stored encrypted and are never shown again.</p>
      <SubmitButton pending={pending}>Save</SubmitButton>
    </form>
  );
}
