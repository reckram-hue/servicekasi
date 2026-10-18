'use client';

import { useActionState, useState } from 'react';
import { grantBusinessAccessAction, revokeBusinessAccessAction, switchBusinessAction } from '@/lib/auth/businessAccess';
import { Field, SubmitButton } from '@/components/auth/ui';

function AccessMessage({ state }: { state: { error?: string; ok?: string } | undefined }) {
  return <div aria-live="polite">{state?.error && <p role="alert" className="mb-3 text-sm text-red-300">{state.error}</p>}
    {state?.ok && <p className="mb-3 text-sm text-emerald-300">{state.ok}</p>}</div>;
}

export function GrantBusinessAccessForm() {
  const [state, action, pending] = useActionState(grantBusinessAccessAction, undefined);
  return <form action={action}>
    <AccessMessage state={state} />
    <Field label="Helper’s login email" name="email" type="email" required autoComplete="off" />
    <label className="mb-4 flex items-start gap-2 text-sm text-slate-300">
      <input type="checkbox" name="acknowledge" required className="mt-1" />
      I trust this person to view and edit my business details, customers, jobs, finances and team as an administrator.
    </label>
    <SubmitButton pending={pending}>Grant helper access</SubmitButton>
  </form>;
}

export function RevokeBusinessAccessForm({ membershipId, name }: { membershipId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(revokeBusinessAccessAction, undefined);
  return <div>
    <AccessMessage state={state} />
    {confirming ? <form action={action} className="space-y-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <p className="text-sm text-slate-300">Revoke {name}’s access to this business now?</p>
      <div className="flex gap-3">
        <button disabled={pending} className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200 disabled:opacity-50">{pending ? 'Revoking…' : 'Confirm revoke'}</button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="text-sm text-slate-300">Cancel</button>
      </div>
    </form> : <button type="button" onClick={() => setConfirming(true)} className="text-sm text-amber-400 hover:underline">Revoke access for {name}</button>}
  </div>;
}

export function SwitchBusinessForm({ businesses, activeTenantId }: {
  businesses: { id: string; name: string; role: string }[]; activeTenantId: string | null;
}) {
  const [state, action, pending] = useActionState(switchBusinessAction, undefined);
  return <form action={action} className="space-y-4">
    <AccessMessage state={state} />
    <label className="block text-sm text-slate-300">Business
      <select name="tenantId" defaultValue={businesses.find((b) => b.id === activeTenantId)?.id ?? businesses[0]?.id} required className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-100">
        {businesses.map((business) => <option key={business.id} value={business.id}>{business.name} — {business.role}</option>)}
      </select>
    </label>
    <SubmitButton pending={pending}>Open business</SubmitButton>
  </form>;
}
