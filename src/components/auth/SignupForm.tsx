'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signupAction } from '@/lib/auth/actions';
import { Field, FormMessage, SubmitButton } from './ui';

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, undefined);
  const e = state?.fieldErrors;
  return (
    <form action={action}>
      <FormMessage error={state?.error} />
      <Field label="Business name" name="businessName" required errors={e?.businessName} placeholder="e.g. Kasi Plumbing" />
      <Field label="Your name" name="name" autoComplete="name" required errors={e?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required errors={e?.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        errors={e?.password}
        hint="At least 10 characters. A short sentence is easy to remember."
      />
      <SubmitButton pending={pending}>Create my business account</SubmitButton>
      <p className="mt-4 text-center text-sm text-slate-400">
        Already registered?{' '}
        <Link href="/login" className="text-amber-400 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
