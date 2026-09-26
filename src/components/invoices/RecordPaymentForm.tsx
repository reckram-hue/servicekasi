'use client';

import { useActionState } from 'react';
import { recordPaymentAction, type FormState } from '@/lib/invoices/actions';
import { Field, FormMessage, Select, SubmitButton } from '@/components/auth/ui';
import { MANUAL_PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/invoices/paymentMethods';

/**
 * Records a payment (kind "payment", amount = balance due) or a refund paid
 * back to the client (kind "refund", amount = refund due).
 *
 * Give this a `key` that changes with the balance (e.g. key={balanceCents})
 * so it remounts with a fresh default amount after each payment — its fields
 * are uncontrolled, and React resets them to their original defaultValue
 * (not a newly rendered one) once the action completes.
 */
export function RecordPaymentForm({
  kind,
  invoiceId,
  amountCents,
  today,
}: {
  kind: 'payment' | 'refund';
  invoiceId: string;
  amountCents: number;
  today: string;
}) {
  const isRefund = kind === 'refund';
  const [state, action, pending] = useActionState<FormState, FormData>(recordPaymentAction, undefined);

  return (
    <form action={action} className="rounded-xl border border-slate-800 p-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="kind" value={kind} />
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">{isRefund ? 'Record a refund' : 'Record a payment'}</h2>
      {isRefund && (
        <p className="-mt-2 mb-3 text-xs text-slate-400">
          After a credit note the client has paid more than they owe. Record the money once you have paid it back.
        </p>
      )}
      <FormMessage error={state?.error} ok={state?.ok} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Amount"
          name="amount"
          inputMode="decimal"
          defaultValue={(amountCents / 100).toFixed(2)}
          errors={state?.fieldErrors?.amount}
        />
        <Field label={isRefund ? 'Date paid back' : 'Date received'} name="date" type="date" max={today} defaultValue={today} errors={state?.fieldErrors?.date} />
      </div>
      <Select label="Method" name="method" defaultValue="EFT" errors={state?.fieldErrors?.method}>
        {MANUAL_PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </Select>
      <Field label="Reference (optional)" name="reference" placeholder="e.g. bank ref, receipt #" errors={state?.fieldErrors?.reference} />
      <SubmitButton pending={pending}>{isRefund ? 'Record refund' : 'Record payment'}</SubmitButton>
    </form>
  );
}
