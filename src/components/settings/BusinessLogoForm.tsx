'use client';

import { useEffect, useState, useTransition } from 'react';
import { logoFileError } from '@/lib/settings/logo';
import { uploadBusinessLogoAction, type LogoUploadResult } from '@/lib/settings/logoActions';

export function BusinessLogoForm({ logoUrl, businessName }: { logoUrl: string | null; businessName: string }) {
  const [selected, setSelected] = useState<{ file: File; url: string } | null>(null);
  const [feedback, setFeedback] = useState<LogoUploadResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => {
    if (selected) URL.revokeObjectURL(selected.url);
  }, [selected]);

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    // Store the file separately so a failed upload can be retried and the same file reselected.
    event.currentTarget.value = '';
    if (!file) return;
    setSelected(null);
    const error = logoFileError(file);
    setFeedback(error ? { error } : null);
    if (!error) setSelected({ file, url: URL.createObjectURL(file) });
  }

  function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || pending) return;
    const data = new FormData();
    data.set('logo', selected.file);
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await uploadBusinessLogoAction(data);
        setFeedback(result);
        if (result.ok) setSelected(null);
      } catch {
        setFeedback({ error: 'Could not upload the logo. Check your connection and try again.' });
      }
    });
  }

  const previewUrl = selected?.url ?? logoUrl;
  return (
    <form onSubmit={upload} className="mb-6" aria-busy={pending}>
      <fieldset disabled={pending} className="rounded-xl border border-slate-800 p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">Business logo</legend>
        <p id="logo-help" className="mb-3 text-sm text-slate-400">
          Shown on your booking page, quotes, invoices and arrival notices. JPG or PNG, up to 2 MB.
        </p>
        <div className="mb-3 flex h-40 items-center justify-center rounded-lg border border-slate-700 bg-white p-3">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={`${businessName} logo${selected ? ' preview' : ''}`} className="max-h-full max-w-full object-contain" />
          ) : <span className="text-sm text-slate-500">No logo uploaded</span>}
        </div>
        <label htmlFor="business-logo" className="mb-1 block text-sm font-medium text-slate-200">
          {logoUrl ? 'Choose a replacement logo' : 'Choose your logo'}
        </label>
        <input
          id="business-logo"
          type="file"
          accept="image/jpeg,image/png"
          onChange={chooseFile}
          aria-describedby="logo-help"
          className="block w-full min-w-0 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-100 focus-visible:outline-2 focus-visible:outline-amber-400"
        />
        {selected && <p className="mt-2 break-all text-xs text-slate-400">{selected.file.name} — ready to upload</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" disabled={!selected || pending} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
            {pending ? 'Uploading…' : 'Upload logo'}
          </button>
          {selected && <button type="button" onClick={() => { setSelected(null); setFeedback(null); }} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200">Cancel</button>}
        </div>
        {feedback?.error && <p role="alert" className="mt-3 text-sm text-red-400">{feedback.error}</p>}
        {feedback?.ok && <p role="status" className="mt-3 text-sm text-emerald-400">{feedback.ok}</p>}
      </fieldset>
    </form>
  );
}
