'use client';

import { startTransition, useActionState, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { signupAction } from '@/lib/auth/actions';
import { INDUSTRIES, INDUSTRY_LABELS } from '@/lib/onboarding/industries';
import { Field, FormMessage, RadioGroup, Select, SubmitButton } from './ui';

const noopSubscribe = () => () => {};

export function SignupForm({ initialIndustry = '' }: { initialIndustry?: string } = {}) {
  const [state, action, pending] = useActionState(signupAction, undefined);
  const e = state?.fieldErrors;
  const [industry, setIndustry] = useState(initialIndustry);

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
        label="What type of business do you run?"
        name="industry"
        required
        defaultValue={initialIndustry}
        onChange={(event) => setIndustry(event.target.value)}
        errors={e?.industry}
        hint="We'll tailor your setup and add starter services you can customise."
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
      {industry === 'MOBILE_CAR_WASH' && <p className="mb-4 rounded-xl border border-cyan-800 bg-cyan-950/40 p-4 text-sm text-cyan-100">Your mobile car wash workspace: plan washes at customers’ homes or workplaces, organise your wash team, invoice customers and track running costs. Add your own prices before activating the starter wash services.</p>}
      <RadioGroup
        label="Do you do the work yourself?"
        name="fieldwork"
        defaultValue="SOLO"
        errors={e?.fieldwork}
        options={[
          { value: 'SOLO', label: "Yes, it's just me" },
          { value: 'TEAM', label: 'Yes, and I also have a team' },
          { value: 'MANAGE', label: "No, I manage — my team does the work" },
        ]}
        hint="This decides whether you can be assigned to your own jobs. You can change it later in Team settings."
      />
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
