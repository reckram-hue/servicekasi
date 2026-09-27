'use client';

import { useActionState } from 'react';
import type { Industry } from '@prisma/client';
import { addStarterItemsAction, type FormState } from '@/lib/priceList/actions';
import { INDUSTRIES, INDUSTRY_LABELS } from '@/lib/onboarding/industries';
import { FormMessage } from '@/components/auth/ui';

export function StarterItemsPanel({ industry }: { industry: Industry | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addStarterItemsAction, undefined);

  return (
    <form action={action} className="mb-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-2 text-sm font-medium text-slate-200">Starter services</div>
      <p className="mb-3 text-xs text-slate-400">
        Add common jobs for a trade in one go. Anything you already have is skipped, and you can edit or switch off any item afterwards.
      </p>
      <FormMessage error={state?.error ?? state?.fieldErrors?.industry?.[0]} ok={state?.ok} />
      <div className="flex flex-wrap gap-2">
        <select
          name="industry"
          defaultValue={industry ?? ''}
          aria-label="Trade"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
        >
          <option value="" disabled>
            Choose a trade…
          </option>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>
              {INDUSTRY_LABELS[i]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
        >
          {pending ? 'Adding…' : 'Add starter services'}
        </button>
      </div>
    </form>
  );
}
