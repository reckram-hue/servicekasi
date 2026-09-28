'use client';

import { useActionState } from 'react';
import { submitServiceRequestAction, type PublicFormState } from '@/lib/requests/publicActions';

export function PublicBookingForm({ slug, businessName }: { slug: string; businessName: string }) {
  const [state, action, pending] = useActionState<PublicFormState, FormData>(submitServiceRequestAction, undefined);

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-800 bg-emerald-500/10 p-5 text-center">
        <p className="text-lg font-semibold text-emerald-300">Thanks — request sent!</p>
        <p className="mt-1 text-sm text-emerald-200">{businessName} will be in touch soon.</p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <input type="hidden" name="slug" value={slug} />
      {/* Honeypot: hidden from real visitors with CSS (not `type="hidden"`, which some bots skip filling). */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state?.error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{state.error}</p>}

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Your name</span>
        <input
          name="contactName"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Cellphone number</span>
        <input
          name="contactPhone"
          type="tel"
          required
          placeholder="082 123 4567"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-300">What do you need done?</span>
        <textarea
          name="description"
          required
          rows={4}
          placeholder="e.g. Geyser is leaking, need someone to look at it this week"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
        />
      </label>

      <label className="mb-5 block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Preferred date (optional)</span>
        <input
          name="preferredDate"
          type="date"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 focus:border-amber-400 focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Request a quote'}
      </button>
    </form>
  );
}
