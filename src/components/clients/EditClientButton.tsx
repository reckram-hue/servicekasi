'use client';

import { useState } from 'react';
import { EditClientModal, type ClientRow } from './ClientsPageClient';

export function EditClientButton({ client }: { client: ClientRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
      >
        Edit
      </button>
      {open && <EditClientModal client={client} onClose={() => setOpen(false)} />}
    </>
  );
}
