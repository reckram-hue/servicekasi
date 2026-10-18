'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { Industry } from '@prisma/client';
import { INDUSTRIES, INDUSTRY_LABELS } from '@/lib/onboarding/industries';
import { updateBusinessTypeAction } from '@/lib/settings/businessTypeActions';
import { Select, SubmitButton } from '@/components/auth/ui';

export function BusinessTypeForm({ industry }: { industry: Industry | null }) {
  const [state, action, pending] = useActionState(updateBusinessTypeAction, undefined);
  return <form action={action} className="mb-6 rounded-xl border border-slate-800 p-4">
    <Select label="Business type" name="industry" defaultValue={industry ?? ''} required>
      <option value="" disabled>Choose a business type…</option>
      {INDUSTRIES.map((type) => <option key={type} value={type}>{INDUSTRY_LABELS[type]}</option>)}
    </Select>
    <p className="mb-4 text-sm text-slate-400">Tailors your planner and setup guide to your business. Manage your services and prices in the <Link href="/settings/price-list" className="text-amber-400 underline">price list</Link>.</p>
    <div aria-live="polite">
      {state?.error && <p role="alert" className="mb-3 text-sm text-red-300">{state.error}</p>}
      {state?.ok && <p className="mb-3 text-sm text-emerald-300">{state.ok}</p>}
    </div>
    <SubmitButton pending={pending}>Save business type</SubmitButton>
  </form>;
}
