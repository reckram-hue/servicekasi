'use client';

import { useActionState } from 'react';
import { recordPaymentAction, type FormState } from '@/lib/invoices/actions';
import { Field, FormMessage, Select, SubmitButton } from '@/components/auth/ui';
import { MANUAL_PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/invoices/paymentMethods';

/**
 * Give this a `key` that changes with the balance (e.g. key={balanceCents})
 * so it remounts with a fresh default amount after each payment — its fields
 * are uncontrolled, and React resets them to their original defaultValue
 * (not a newly rendered one) once the action completes.
 */
export function RecordPaymentForm({
  invoiceId,
  balanceCents,
  today,
}: {
  invoiceId: string;
  balanceCents: number;
  today: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordPaymentAction, undefined);

  return (
    <form action={action} className="rounded-xl border border-slate-800 p-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Record a payment</h2>
      <FormMessage error={state?.error} ok={state?.ok} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Amount"
          name="amount"
          inputMode="decimal"
          defaultValue={(balanceCents / 100).toFixed(2)}
          errors={state?.fieldErrors?.amount}
        />
        <Field label="Date received" name="date" type="date" max={today} defaultValue={today} errors={state?.fieldErrors?.date} />
      </div>
      <Select label="Method" name="method" defaultValue="EFT" errors={state?.fieldErrors?.method}>
        {MANUAL_PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </Select>
      <Field label="Reference (optional)" name="reference" placeholder="e.g. bank ref, receipt #" errors={state?.fieldErrors?.reference} />
      <SubmitButton pending={pending}>Record payment</SubmitButton>
    </form>
  );
}
