'use client';

import { useActionState, useState } from 'react';
import Papa from 'papaparse';
import { importClientsAction, type ImportFormState } from '@/lib/clients/importActions';
import { ClientSchema, type ClientInput } from '@/lib/clients/schema';
import { FormMessage, SubmitButton } from '@/components/auth/ui';

const HEADER_MAP: Record<string, string> = {
  'first name': 'firstName',
  'last name': 'lastName',
  company: 'companyName',
  phone: 'phone',
  email: 'email',
  street: 'street',
  suburb: 'suburb',
  city: 'city',
  notes: 'notes',
};

type ParsedFile = {
  fileName: string;
  validRows: ClientInput[];
  invalidCount: number;
  totalRows: number;
};

function mapHeaders(row: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    const key = HEADER_MAP[header.trim().toLowerCase()];
    if (key && value?.trim()) mapped[key] = value.trim();
  }
  return mapped;
}

export function ImportClientsForm() {
  const [state, action, pending] = useActionState<ImportFormState, FormData>(importClientsAction, undefined);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Choosing a new file naturally replaces the preview below (and its hidden `rows`
  // field), so there's nothing to reset here after a successful import — the result
  // message just stays visible until then.
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setParseError(null);
    setParsed(null);

    const text = await file.text();
    const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const fields = (result.meta.fields ?? []).map((f) => f.trim().toLowerCase());
    if (!fields.includes('first name')) {
      setParseError('This doesn’t look like a ServiceKasi client file — make sure it has a "First name" column. Download the template above and compare.');
      return;
    }

    const validRows: ClientInput[] = [];
    let invalidCount = 0;
    for (const row of result.data) {
      const mapped = mapHeaders(row);
      const check = ClientSchema.safeParse({ ...mapped, preferredLanguage: 'en' });
      if (check.success) validRows.push(check.data);
      else invalidCount++;
    }

    setParsed({ fileName: file.name, validRows, invalidCount, totalRows: result.data.length });
  }

  return (
    <div>
      <label className="mb-4 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 p-8 text-center hover:border-slate-500">
        <div>
          <div className="font-medium text-slate-200">Choose a CSV file</div>
          <div className="mt-1 text-sm text-slate-500">First name is required; each row also needs a phone or an email.</div>
        </div>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
      </label>

      {parseError && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{parseError}</p>}

      {parsed && (
        <form action={action} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <FormMessage error={state?.error} ok={state?.ok} />
          <input type="hidden" name="rows" value={JSON.stringify(parsed.validRows)} readOnly />

          <p className="mb-1 text-sm text-slate-300">
            <span className="font-medium text-slate-100">{parsed.fileName}</span> — {parsed.totalRows} row{parsed.totalRows === 1 ? '' : 's'} found
          </p>
          <p className="mb-4 text-sm text-slate-400">
            {parsed.validRows.length} ready to import
            {parsed.invalidCount > 0 && `, ${parsed.invalidCount} skipped (missing a first name, or no phone/email)`}.
          </p>

          {parsed.validRows.length > 0 && (
            <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-slate-800">
              {parsed.validRows.slice(0, 50).map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2 text-sm last:border-0">
                  <span className="truncate text-slate-200">
                    {[r.firstName, r.lastName].filter(Boolean).join(' ')}
                    {r.companyName && <span className="ml-1 text-slate-500">({r.companyName})</span>}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{[r.phone, r.email].filter(Boolean).join(' · ')}</span>
                </div>
              ))}
              {parsed.validRows.length > 50 && (
                <div className="px-3 py-2 text-center text-xs text-slate-500">…and {parsed.validRows.length - 50} more</div>
              )}
            </div>
          )}

          <SubmitButton pending={pending}>
            {parsed.validRows.length > 0 ? `Import ${parsed.validRows.length} client${parsed.validRows.length === 1 ? '' : 's'}` : 'Nothing to import'}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
