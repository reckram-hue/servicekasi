'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientAction, toggleArchiveClientAction, updateClientAction, type FormState } from '@/lib/clients/actions';
import { FormMessage, SubmitButton } from '@/components/auth/ui';
import { ClientFormFields } from './ClientFormFields';
import { Modal } from '@/components/ui/Modal';

export type ClientRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  preferredLanguage: string;
  notes: string | null;
  whatsappOptIn: boolean;
  archived: boolean;
  properties: { street: string; suburb: string | null; city: string; region: string | null; postalCode: string | null; accessNotes: string | null }[];
};

function displayName(c: ClientRow) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ');
}

// ───────────────────────── search ─────────────────────────

function SearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function onChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (next.trim()) params.set('q', next.trim());
        router.replace(`/clients${params.toString() ? `?${params}` : ''}`);
      });
    }, 300);
  }

  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search by name, company, phone or email…"
      className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
      aria-busy={isPending}
    />
  );
}

// ───────────────────────── add ─────────────────────────

function AddClientButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createClientAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => setOpen(false), 800);
      return () => clearTimeout(t);
    }
  }, [state?.ok]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
      >
        + Add client
      </button>
      {open && (
        <Modal title="Add client" onClose={() => setOpen(false)}>
          <form action={action}>
            <FormMessage error={state?.error} ok={state?.ok} />
            <ClientFormFields errors={state?.fieldErrors} />
            <SubmitButton pending={pending}>Add client</SubmitButton>
          </form>
        </Modal>
      )}
    </>
  );
}

// ───────────────────────── edit ─────────────────────────

function EditClientModal({ client, onClose }: { client: ClientRow; onClose: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateClientAction, undefined);
  const property = client.properties[0];

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 800);
      return () => clearTimeout(t);
    }
  }, [state?.ok, onClose]);

  return (
    <Modal title={`Edit ${displayName(client)}`} onClose={onClose}>
      <form action={action}>
        <input type="hidden" name="id" value={client.id} />
        <FormMessage error={state?.error} ok={state?.ok} />
        <ClientFormFields
          errors={state?.fieldErrors}
          defaults={{
            firstName: client.firstName,
            lastName: client.lastName ?? undefined,
            companyName: client.companyName ?? undefined,
            phone: client.phone ?? undefined,
            email: client.email ?? undefined,
            preferredLanguage: client.preferredLanguage,
            notes: client.notes ?? undefined,
            whatsappOptIn: client.whatsappOptIn,
            street: property?.street,
            suburb: property?.suburb ?? undefined,
            city: property?.city,
            region: property?.region ?? undefined,
            postalCode: property?.postalCode ?? undefined,
            accessNotes: property?.accessNotes ?? undefined,
          }}
        />
        <SubmitButton pending={pending}>Save changes</SubmitButton>
      </form>
    </Modal>
  );
}

// ───────────────────────── archive toggle ─────────────────────────

function ArchiveToggle({ client }: { client: ClientRow }) {
  return (
    <form action={toggleArchiveClientAction}>
      <input type="hidden" name="id" value={client.id} />
      <input type="hidden" name="archived" value={String(client.archived)} />
      <button
        type="submit"
        className={`rounded-md px-3 py-1 text-xs font-medium ${
          client.archived ? 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        {client.archived ? 'Restore' : 'Archive'}
      </button>
    </form>
  );
}

// ───────────────────────── page ─────────────────────────

export function ClientsPageClient({ clients, query }: { clients: ClientRow[]; query: string }) {
  const [editing, setEditing] = useState<ClientRow | null>(null);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SearchBar initialQuery={query} />
        <AddClientButton />
      </div>

      {clients.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500">
          {query ? 'No clients match your search.' : 'No clients yet. Add your first one to get started.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {clients.map((c) => (
            <div
              key={c.id}
              className={`flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4 last:border-0 ${c.archived ? 'opacity-50' : ''}`}
            >
              <div>
                <div className="font-medium text-slate-100">
                  {displayName(c)}
                  {c.companyName && <span className="ml-2 text-xs text-slate-500">{c.companyName}</span>}
                </div>
                <div className="text-xs text-slate-400">
                  {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact details'}
                  {c.properties[0] && ` · ${c.properties[0].city}`}
                  {' · language: '}
                  {c.preferredLanguage}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/quotes/new?client=${c.id}`}
                  className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  New quote
                </Link>
                <Link
                  href={`/jobs/new?client=${c.id}`}
                  className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  New job
                </Link>
                <Link
                  href={`/invoices/new?client=${c.id}`}
                  className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  New invoice
                </Link>
                <button
                  onClick={() => setEditing(c)}
                  className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  Edit
                </button>
                <ArchiveToggle client={c} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <EditClientModal client={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
