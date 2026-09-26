'use client';

import { startTransition, useActionState, useState, useSyncExternalStore } from 'react';
import { createCreditNoteAction, type FormState } from '@/lib/invoices/actions';
import { formatMoney, lineTotals, parseMoneyInput } from '@/lib/money';
import { FormMessage, TextArea } from '@/components/auth/ui';

export type CreditableLine = {
  id: string;
  description: string;
  invoicedCents: number;
  remainingCents: number;
  remainingVatCents: number;
  taxRateBp: number;
};

const noopSubscribe = () => () => {};

export function CreditNoteForm({
  invoiceId,
  invoiceNumber,
  currencyCode,
  showVat,
  lines,
}: {
  invoiceId: string;
  invoiceNumber: string;
  currencyCode: string;
  showVat: boolean;
  lines: CreditableLine[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createCreditNoteAction, undefined);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const interactive = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const money = (cents: number) => formatMoney(cents, currencyCode);

  // Mirrors the server: crediting all that's left of a line credits exactly the VAT left on it.
  const totals = lines.reduce(
    (t, l) => {
      const cents = Math.max(0, parseMoneyInput(amounts[l.id] ?? '') ?? 0);
      const vat = cents === l.remainingCents ? l.remainingVatCents : lineTotals({ quantity: 1, unitPriceCents: cents, taxRateBp: l.taxRateBp }).taxCents;
      return { subtotalCents: t.subtotalCents + cents, taxCents: t.taxCents + vat, totalCents: t.totalCents + cents + vat };
    },
    { subtotalCents: 0, taxCents: 0, totalCents: 0 }
  );
  const creditsJson = JSON.stringify(lines.map((l) => ({ lineItemId: l.id, amount: amounts[l.id] ?? '' })));

  function creditEverything() {
    setAmounts(Object.fromEntries(lines.map((l) => [l.id, l.remainingCents > 0 ? (l.remainingCents / 100).toFixed(2) : ''])));
  }

  // Submitted through a handler, not <form action>, so an error doesn't reset
  // the typed amounts (React resets forms after an action completes).
  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!window.confirm(`Issue a credit note for ${money(totals.totalCents)} against ${invoiceNumber}? It gets its number and can't be changed.`)) return;
    const formData = new FormData(ev.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="creditsJson" value={creditsJson} />
      <FormMessage error={state?.error} />

      <div className="mb-6 rounded-xl border border-slate-800 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">What to credit{showVat ? ' (excl. VAT)' : ''}</h2>
          <button type="button" onClick={creditEverything} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700">
            Credit everything
          </button>
        </div>
        <div className="space-y-3">
          {lines.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_8rem] items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div>
                <div className="text-sm text-slate-100">{l.description}</div>
                <div className="text-xs text-slate-500">
                  Invoiced {money(l.invoicedCents)}
                  {l.remainingCents < l.invoicedCents && ` · ${money(l.remainingCents)} left to credit`}
                  {showVat && ` · VAT ${l.taxRateBp / 100}%`}
                </div>
              </div>
              <input
                value={amounts[l.id] ?? ''}
                onChange={(ev) => setAmounts((a) => ({ ...a, [l.id]: ev.target.value }))}
                disabled={l.remainingCents === 0}
                placeholder={l.remainingCents === 0 ? 'Credited' : '0.00'}
                inputMode="decimal"
                aria-label={`Amount to credit on ${l.description}`}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-right text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none disabled:opacity-50"
              />
            </div>
          ))}
        </div>
      </div>

      <TextArea
        label="Reason (printed on the credit note)"
        name="reason"
        value={reason}
        onChange={(ev) => setReason(ev.target.value)}
        placeholder="e.g. Call-out fee charged twice"
        errors={state?.fieldErrors?.reason}
      />

      <div className="mb-6 rounded-xl border border-slate-800 p-4 text-sm">
        {showVat && (
          <>
            <div className="flex justify-between text-slate-300">
              <span>Credit excl. VAT</span>
              <span>{money(totals.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>VAT</span>
              <span>{money(totals.taxCents)}</span>
            </div>
          </>
        )}
        <div className="mt-1 flex justify-between border-t border-slate-800 pt-1 font-semibold text-slate-100">
          <span>Total credit{showVat ? ' incl. VAT' : ''}</span>
          <span>{money(totals.totalCents)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || !interactive || totals.totalCents <= 0}
        className="w-full rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
      >
        {pending ? 'Please wait…' : 'Issue credit note'}
      </button>
    </form>
  );
}
