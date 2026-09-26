'use client';

import { useActionState, useState } from 'react';
import { approveQuoteAction, declineQuoteAction, requestQuoteChangesAction, type PublicFormState } from '@/lib/quotes/publicActions';
import { documentTotals, formatMoney, type MoneyLineInput } from '@/lib/money';

export type PublicLine = {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRateBp: number;
  optional: boolean;
  selected: boolean;
};

export function PublicQuoteView({
  token,
  version,
  clientName,
  currencyCode,
  lines,
  depositPercent,
}: {
  token: string;
  /** The quote's updatedAt, so the server can refuse an approval of a version the client never saw. */
  version: string;
  clientName: string;
  currencyCode: string;
  lines: PublicLine[];
  depositPercent: number | null;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(lines.map((l) => [l.id, l.optional ? l.selected : true]))
  );
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [showDecline, setShowDecline] = useState(false);

  const [approveState, approveAction, approvePending] = useActionState<PublicFormState, FormData>(approveQuoteAction, undefined);
  const [changesState, changesAction, changesPending] = useActionState<PublicFormState, FormData>(requestQuoteChangesAction, undefined);
  const [declineState, declineAction, declinePending] = useActionState<PublicFormState, FormData>(declineQuoteAction, undefined);

  const moneyLines: MoneyLineInput[] = lines.map((l) => ({
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    taxRateBp: l.taxRateBp,
    optional: l.optional,
    selected: selected[l.id] ?? true,
  }));
  const totals = documentTotals(moneyLines);
  const depositCents = depositPercent ? Math.round((totals.totalCents * depositPercent) / 100) : 0;
  const selectedLineIds = JSON.stringify(lines.filter((l) => l.optional && selected[l.id]).map((l) => l.id));

  if (approveState?.ok) {
    return (
      <div className="rounded-xl border border-emerald-800 bg-emerald-500/10 p-5 text-center">
        <p className="text-lg font-semibold text-emerald-300">Thank you, {clientName}!</p>
        <p className="mt-1 text-sm text-emerald-200">Your quote has been approved. We&apos;ll be in touch to schedule the work.</p>
        <p className="mt-3 text-xl font-bold text-slate-100">{formatMoney(totals.totalCents, currencyCode)}</p>
      </div>
    );
  }

  if (changesState?.ok) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-center">
        <p className="text-lg font-semibold text-slate-100">Thanks, {clientName}.</p>
        <p className="mt-1 text-sm text-slate-400">We&apos;ve let the business know what you&apos;d like changed. They&apos;ll be in touch with an updated quote.</p>
      </div>
    );
  }

  if (declineState?.ok) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-center">
        <p className="text-lg font-semibold text-slate-100">Quote declined.</p>
        <p className="mt-1 text-sm text-slate-400">Thanks for letting us know, {clientName}.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {lines.map((line) => (
          <div key={line.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 p-3">
            <div className="flex items-start gap-3">
              {line.optional && (
                <input
                  type="checkbox"
                  checked={selected[line.id] ?? true}
                  onChange={(ev) => setSelected((s) => ({ ...s, [line.id]: ev.target.checked }))}
                  className="mt-1 h-4 w-4 rounded"
                  aria-label={`Include ${line.description}`}
                />
              )}
              <div>
                <div className="text-sm font-medium text-slate-100">
                  {line.description}
                  {line.optional && <span className="ml-2 text-xs text-amber-400">optional</span>}
                </div>
                <div className="text-xs text-slate-400">
                  {line.quantity} × {formatMoney(line.unitPriceCents, currencyCode)}
                </div>
              </div>
            </div>
            <div className="whitespace-nowrap text-sm text-slate-200">
              {formatMoney(Math.round(line.quantity * line.unitPriceCents), currencyCode)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1 border-t border-slate-800 pt-3 text-sm">
        <div className="flex justify-between text-slate-300">
          <span>Subtotal</span>
          <span>{formatMoney(totals.subtotalCents, currencyCode)}</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>VAT</span>
          <span>{formatMoney(totals.taxCents, currencyCode)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold text-slate-100">
          <span>Total</span>
          <span>{formatMoney(totals.totalCents, currencyCode)}</span>
        </div>
        {depositCents > 0 && (
          <div className="flex justify-between text-amber-400">
            <span>Deposit required ({depositPercent}%)</span>
            <span>{formatMoney(depositCents, currencyCode)}</span>
          </div>
        )}
      </div>

      <form action={approveAction} className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="selectedLineIds" value={selectedLineIds} />
        <h2 className="mb-3 font-semibold text-slate-100">Approve this quote</h2>
        {approveState?.error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{approveState.error}</p>}
        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-slate-300">Your name</span>
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={clientName}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 focus:border-amber-400 focus:outline-none"
          />
        </label>
        <label className="mb-4 flex items-start gap-2 text-sm text-slate-300">
          <input type="checkbox" name="accepted" required className="mt-0.5 h-4 w-4 rounded" />
          <span>I accept this quote for {formatMoney(totals.totalCents, currencyCode)}.</span>
        </label>
        <button
          type="submit"
          disabled={approvePending}
          className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
        >
          {approvePending ? 'Please wait…' : 'Approve quote'}
        </button>
      </form>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => setShowRequestChanges((v) => !v)}
          className="flex-1 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          Request changes
        </button>
        <button
          type="button"
          onClick={() => setShowDecline((v) => !v)}
          className="flex-1 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          Decline
        </button>
      </div>

      {showRequestChanges && (
        <form action={changesAction} className="mt-3 rounded-xl border border-slate-800 p-4">
          <input type="hidden" name="token" value={token} />
          {changesState?.error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{changesState.error}</p>}
          <label className="mb-3 block">
            <span className="mb-1 block text-sm text-slate-300">What would you like changed?</span>
            <textarea
              name="message"
              required
              maxLength={2000}
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 focus:border-amber-400 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={changesPending}
            className="w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-600 disabled:opacity-60"
          >
            {changesPending ? 'Sending…' : 'Send request'}
          </button>
        </form>
      )}

      {showDecline && (
        <form action={declineAction} className="mt-3 rounded-xl border border-slate-800 p-4">
          <input type="hidden" name="token" value={token} />
          {declineState?.error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{declineState.error}</p>}
          <label className="mb-3 block">
            <span className="mb-1 block text-sm text-slate-300">Let us know why (optional)</span>
            <textarea
              name="message"
              maxLength={2000}
              rows={2}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 focus:border-amber-400 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={declinePending}
            className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-60"
          >
            {declinePending ? 'Sending…' : 'Decline quote'}
          </button>
        </form>
      )}
    </div>
  );
}
