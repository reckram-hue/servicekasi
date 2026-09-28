'use client';

import { useState } from 'react';

export function BookingPageLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (e.g. no permission) — the link is still visible to copy manually.
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-800 p-4">
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-500">Your booking page</h2>
      <p className="mb-3 text-sm text-slate-400">
        Paste this into your Google Business Profile&rsquo;s booking or website link, so people who find you on Google can request a quote
        straight away. New requests show up under{' '}
        <a href="/requests" className="text-amber-400 hover:underline">
          Requests
        </a>
        .
      </p>
      <div className="flex items-center gap-2">
        <input readOnly value={url} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300" />
        <button
          type="button"
          onClick={copyLink}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          View
        </a>
      </div>
    </div>
  );
}
