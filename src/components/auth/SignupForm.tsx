'use client';

import { startTransition, useActionState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { signupAction } from '@/lib/auth/actions';
import { INDUSTRIES, INDUSTRY_LABELS } from '@/lib/onboarding/industries';
import { Field, FormMessage, Select, SubmitButton } from './ui';

const noopSubscribe = () => () => {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, undefined);
  const e = state?.fieldErrors;

  // A handler instead of <form action> so a failed attempt (e.g. email already
  // used) keeps what was typed instead of React clearing the form.
  const interactive = useSyncExternalStore(noopSubscribe, () => true, () => false);

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const formData = new FormData(ev.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit}>
      <FormMessage error={state?.error} />
      <Field label="Business name" name="businessName" required errors={e?.businessName} placeholder="e.g. Kasi Plumbing" />
      <Select
        label="What's your trade?"
        name="industry"
        required
        defaultValue=""
        errors={e?.industry}
        hint="We'll fill your price list with common jobs for your trade. You can change or add anything later."
      >
        <option value="" disabled>
          Choose one…
        </option>
        {INDUSTRIES.map((i) => (
          <option key={i} value={i}>
            {INDUSTRY_LABELS[i]}
          </option>
        ))}
      </Select>
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
      <SubmitButton pending={pending || !interactive}>Create my business account</SubmitButton>
      <p className="mt-4 text-center text-sm text-slate-400">
        Already registered?{' '}
        <Link href="/login" className="text-amber-400 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
