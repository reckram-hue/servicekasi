'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { emailLoginAction, pinLoginAction } from '@/lib/auth/actions';
import { Field, FormMessage, SubmitButton } from './ui';

export function LoginForms({ notice }: { notice?: string }) {
  const [tab, setTab] = useState<'office' | 'technician'>('office');
  const [emailState, emailAction, emailPending] = useActionState(emailLoginAction, undefined);
  const [pinState, pinAction, pinPending] = useActionState(pinLoginAction, undefined);

  const tabClass = (active: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`;

  return (
    <>
      <div className="mb-6 flex gap-1 rounded-lg bg-slate-950 p-1">
        <button type="button" className={tabClass(tab === 'office')} onClick={() => setTab('office')}>
          Owner / office
        </button>
        <button type="button" className={tabClass(tab === 'technician')} onClick={() => setTab('technician')}>
          Technician
        </button>
      </div>

      <FormMessage error={notice} />

      {tab === 'office' ? (
        <form action={emailAction}>
          <FormMessage error={emailState?.error} />
          <Field label="Email" name="email" type="email" autoComplete="email" required errors={emailState?.fieldErrors?.email} />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            errors={emailState?.fieldErrors?.password}
          />
          <SubmitButton pending={emailPending}>Log in</SubmitButton>
          <p className="mt-4 text-center text-sm text-slate-400">
            New business?{' '}
            <Link href="/signup" className="text-amber-400 hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      ) : (
        <form action={pinAction}>
          <FormMessage error={pinState?.error} />
          <Field
            label="Cellphone number"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="082 123 4567"
            required
            errors={pinState?.fieldErrors?.phone}
          />
          <Field
            label="PIN"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            required
            errors={pinState?.fieldErrors?.pin}
          />
          <SubmitButton pending={pinPending}>Log in</SubmitButton>
          <p className="mt-4 text-center text-xs text-slate-500">Forgot your PIN? Ask your manager to reset it.</p>
        </form>
      )}
    </>
  );
}
