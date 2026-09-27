'use client';

import { useActionState } from 'react';
import { addTransferAction, type FormState } from '@/lib/bookkeeping/actions';
import { Field, FormMessage, Select, SubmitButton } from '@/components/auth/ui';

type Option = { id: string; name: string };

export function AddTransferForm({ today, accounts }: { today: string; accounts: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addTransferAction, undefined);

  return (
    <form action={action} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <FormMessage error={state?.error} ok={state?.ok} />
      <Select label="From" name="fromMoneyAccountId" errors={state?.fieldErrors?.fromMoneyAccountId}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <Select label="To" name="toMoneyAccountId" defaultValue={accounts[1]?.id} errors={state?.fieldErrors?.toMoneyAccountId}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" name="amount" inputMode="decimal" placeholder="0.00" errors={state?.fieldErrors?.amount} />
        <Field label="Date" name="date" type="date" max={today} defaultValue={today} errors={state?.fieldErrors?.date} />
      </div>
      <Field
        label="Of which interest (optional)"
        name="interestAmount"
        inputMode="decimal"
        placeholder="0.00"
        hint="Only for a loan repayment that includes interest — the rest reduces what's owed."
        errors={state?.fieldErrors?.interestAmount}
      />
      <Field label="Memo (optional)" name="memo" placeholder="e.g. Monthly vehicle finance" errors={state?.fieldErrors?.memo} />
      <SubmitButton pending={pending}>Transfer</SubmitButton>
    </form>
  );
}
