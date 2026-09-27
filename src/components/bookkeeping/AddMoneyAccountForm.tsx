'use client';

import { useActionState } from 'react';
import { MoneyAccountType } from '@prisma/client';
import { addMoneyAccountAction, type FormState } from '@/lib/bookkeeping/actions';
import { Field, FormMessage, Select, SubmitButton } from '@/components/auth/ui';
import { MONEY_ACCOUNT_TYPE_LABEL } from '@/lib/bookkeeping/labels';

export function AddMoneyAccountForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addMoneyAccountAction, undefined);

  return (
    <form action={action} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <FormMessage error={state?.error} ok={state?.ok} />
      <Select label="Type" name="type" defaultValue="BANK" errors={state?.fieldErrors?.type}>
        {Object.values(MoneyAccountType).map((t) => (
          <option key={t} value={t}>
            {MONEY_ACCOUNT_TYPE_LABEL[t]}
          </option>
        ))}
      </Select>
      <Field label="Name" name="name" placeholder="e.g. FNB Cheque account" errors={state?.fieldErrors?.name} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Opening balance"
          name="openingBalance"
          inputMode="decimal"
          defaultValue="0.00"
          hint="What's in it (or what's owed on it) as of the date below."
          errors={state?.fieldErrors?.openingBalance}
        />
        <Field label="As of" name="openingDate" type="date" max={today} defaultValue={today} errors={state?.fieldErrors?.openingDate} />
      </div>
      <SubmitButton pending={pending}>Add account</SubmitButton>
    </form>
  );
}
