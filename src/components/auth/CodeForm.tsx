'use client';

import { useActionState } from 'react';
import type { FormState } from '@/lib/auth/actions';
import { Field, FormMessage, SubmitButton } from './ui';

/** A single "enter the 6-digit code" form, used for login and for setup. */
export function CodeForm({
  action,
  button,
  autoFocus = true,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  button: string;
  autoFocus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction}>
      <FormMessage error={state?.error} />
      <Field
        label="6-digit code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        placeholder="123 456"
        required
        autoFocus={autoFocus}
      />
      <SubmitButton pending={pending}>{button}</SubmitButton>
    </form>
  );
}
