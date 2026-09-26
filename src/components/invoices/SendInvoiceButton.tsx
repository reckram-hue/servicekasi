'use client';

import { useState } from 'react';

export function SendInvoiceButton({ publicUrl, clientPhone, message }: { publicUrl: string; clientPhone: string | null; message: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (e.g. no permission) — the link is still visible to copy manually.
    }
  }

  const whatsappHref = clientPhone ? `https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : undefined;

  return (
    <div className="rounded-xl border border-slate-800 p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Send to client</h2>
      <div className="mb-3 flex items-center gap-2">
        <input readOnly value={publicUrl} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300" />
        <button
          type="button"
          onClick={copyLink}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="flex gap-2">
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Send via WhatsApp
          </a>
        )}
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg border border-slate-700 px-4 py-2.5 text-center text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          View as client
        </a>
      </div>
      {!clientPhone && <p className="mt-2 text-xs text-slate-500">Add a phone number for this client to share via WhatsApp.</p>}
    </div>
  );
}
