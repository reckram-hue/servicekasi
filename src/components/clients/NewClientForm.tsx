'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { createClientAction } from '@/lib/clients/actions';
import { FormMessage, SubmitButton } from '@/components/auth/ui';
import { ClientFormFields } from './ClientFormFields';

export function NewClientForm({ mobileCarWash = false }: { mobileCarWash?: boolean }) {
  const [state, action, pending] = useActionState(createClientAction, undefined);
  if (state?.ok) return (
    <div role="status" className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-5">
      <p className="mb-4 text-emerald-200">{state.ok}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/jobs" className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950">{mobileCarWash ? 'Schedule a wash' : 'Create a job'}</Link>
        <Link href="/clients" className="rounded-lg bg-slate-800 px-4 py-2 text-slate-200">View clients</Link>
      </div>
    </div>
  );
  return (
    <form action={action}>
      <FormMessage error={state?.error} />
      <ClientFormFields errors={state?.fieldErrors} />
      <SubmitButton pending={pending}>Add {mobileCarWash ? 'customer' : 'client'}</SubmitButton>
    </form>
  );
}
