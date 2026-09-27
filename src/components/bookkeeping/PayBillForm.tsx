'use client';

import { useActionState } from 'react';
import { payBillAction, type FormState } from '@/lib/bookkeeping/actions';
import { Field, FormMessage, Select, SubmitButton } from '@/components/auth/ui';

type Option = { id: string; name: string };

/** Give this a `key` that changes with the balance due, same reasoning as RecordPaymentForm — it remounts with a fresh default amount after each payment. */
export function PayBillForm({ billId, balanceCents, today, moneyAccounts }: { billId: string; balanceCents: number; today: string; moneyAccounts: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(payBillAction, undefined);

  if (moneyAccounts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
        Add a money account first so there&rsquo;s somewhere to pay this bill from.
      </div>
    );
  }

  return (
    <form action={action} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <FormMessage error={state?.error} ok={state?.ok} />
      <input type="hidden" name="billId" value={billId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" name="amount" inputMode="decimal" defaultValue={(balanceCents / 100).toFixed(2)} errors={state?.fieldErrors?.amount} />
        <Field label="Date" name="date" type="date" max={today} defaultValue={today} errors={state?.fieldErrors?.date} />
      </div>
      <Select label="Paid from" name="moneyAccountId" errors={state?.fieldErrors?.moneyAccountId}>
        {moneyAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <SubmitButton pending={pending}>Record payment</SubmitButton>
    </form>
  );
}
