'use client';

import { useActionState } from 'react';
import { addTechnicianAction, resetPinAction } from '@/lib/auth/actions';
import { Field, FormMessage, SubmitButton } from './ui';

const LANGUAGES: [string, string][] = [
  ['en', 'English'],
  ['af', 'Afrikaans'],
  ['zu', 'isiZulu'],
  ['xh', 'isiXhosa'],
  ['st', 'Sesotho'],
  ['tn', 'Setswana'],
  ['nso', 'Sepedi'],
  ['ts', 'Xitsonga'],
  ['ss', 'siSwati'],
  ['ve', 'Tshivenda'],
  ['nr', 'isiNdebele'],
  ['pt', 'Português'],
  ['sn', 'chiShona'],
  ['ny', 'chiChewa'],
  ['sw', 'Kiswahili'],
  ['fr', 'Français'],
];

export function AddTechnicianForm() {
  const [state, action, pending] = useActionState(addTechnicianAction, undefined);
  const e = state?.fieldErrors;
  return (
    <form action={action}>
      <FormMessage error={state?.error} ok={state?.ok} />
      <Field label="Name" name="name" required errors={e?.name} />
      <Field label="Cellphone number" name="phone" type="tel" placeholder="082 123 4567" required errors={e?.phone} />
      <Field
        label="PIN (4–6 digits)"
        name="pin"
        inputMode="numeric"
        maxLength={6}
        required
        errors={e?.pin}
        hint="Tell them this PIN in person or by phone."
      />
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Language they prefer</span>
        <select
          name="preferredLanguage"
          defaultValue="en"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
        >
          {LANGUAGES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton pending={pending}>Add technician</SubmitButton>
    </form>
  );
}

export function ResetPinForm({ membershipId }: { membershipId: string }) {
  const [state, action, pending] = useActionState(resetPinAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <input
        name="pin"
        inputMode="numeric"
        maxLength={6}
        placeholder="New PIN"
        required
        className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
      />
      <button disabled={pending} className="rounded-md bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700">
        Reset PIN
      </button>
      {state?.error && <span className="text-xs text-red-400">{state.error}</span>}
      {state?.ok && <span className="text-xs text-emerald-400">{state.ok}</span>}
    </form>
  );
}
