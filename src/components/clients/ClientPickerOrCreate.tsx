'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClientForRedirectAction, type FormState } from '@/lib/clients/actions';
import { FormMessage, SubmitButton } from '@/components/auth/ui';
import { ClientFormFields } from './ClientFormFields';

export type ClientOption = { id: string; name: string; phone: string | null; email: string | null };

/**
 * The first step of starting a quote or invoice: pick an existing client, or
 * add a new one right here and go straight into the builder with them.
 */
export function ClientPickerOrCreate({
  clients,
  returnTo,
  label,
}: {
  clients: ClientOption[];
  /** Where to continue once a client is chosen or created — the builder reads `?client=<id>` from here. */
  returnTo: '/quotes/new' | '/invoices/new';
  /** "quote" or "invoice", for button and heading text. */
  label: string;
}) {
  const [query, setQuery] = useState('');
  const [showNewForm, setShowNewForm] = useState(clients.length === 0);
  const [state, action, pending] = useActionState<FormState, FormData>(createClientForRedirectAction, undefined);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q));
  }, [query, clients]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">New {label}</h1>

      {!showNewForm && (
        <div className="mb-6 rounded-xl border border-slate-800 p-4">
          <div className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Who&apos;s this {label} for?</div>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, company, phone or email…"
            className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
          />
          {filtered.length > 0 ? (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {filtered.map((c) => (
                <Link
                  key={c.id}
                  href={`${returnTo}?client=${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-sm hover:border-amber-400"
                >
                  <span className="font-medium text-slate-100">{c.name}</span>
                  <span className="text-xs text-slate-500">{c.phone || c.email}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-sm text-slate-500">
              No clients match &ldquo;{query}&rdquo;.
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="mt-3 text-sm font-medium text-amber-400 hover:underline"
          >
            + Add a new client
          </button>
        </div>
      )}

      {showNewForm && (
        <div className="rounded-xl border border-slate-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium uppercase tracking-wide text-slate-500">New client</div>
            {clients.length > 0 && (
              <button type="button" onClick={() => setShowNewForm(false)} className="text-xs text-slate-400 hover:underline">
                Choose an existing client instead
              </button>
            )}
          </div>
          <form action={action}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <FormMessage error={state?.error} />
            <ClientFormFields errors={state?.fieldErrors} />
            <SubmitButton pending={pending}>Add client &amp; continue</SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
