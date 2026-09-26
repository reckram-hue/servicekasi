'use client';

import { startTransition, useActionState, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import type { CatalogItemType } from '@prisma/client';
import { createInvoiceAction, updateInvoiceAction, type FormState } from '@/lib/invoices/actions';
import { documentTotals, formatMoney, parseMoneyInput, type MoneyLineInput } from '@/lib/money';
import { CATALOG_ITEM_TYPE_LABELS } from '@/lib/catalogItemTypes';
import { Field, FormMessage, Select, SubmitButton, TextArea } from '@/components/auth/ui';

export type CatalogItemOption = {
  id: string;
  type: CatalogItemType;
  name: string;
  unitCostCents: number;
  unitPriceCents: number;
  taxable: boolean;
};

type LineRow = {
  key: string;
  catalogItemId?: string;
  type: CatalogItemType;
  description: string;
  quantity: string;
  unitCostRands: string;
  unitPriceRands: string;
  taxable: boolean;
};

function blankLine(): LineRow {
  return {
    key: crypto.randomUUID(),
    type: 'SERVICE',
    description: '',
    quantity: '1',
    unitCostRands: '',
    unitPriceRands: '',
    taxable: true,
  };
}

const noopSubscribe = () => () => {};

function toMoneyLine(row: LineRow, vatRegistered: boolean, defaultTaxRateBp: number): MoneyLineInput {
  return {
    quantity: parseFloat(row.quantity) || 0,
    unitPriceCents: parseMoneyInput(row.unitPriceRands) ?? 0,
    unitCostCents: parseMoneyInput(row.unitCostRands) ?? 0,
    taxRateBp: vatRegistered && row.taxable ? defaultTaxRateBp : 0,
  };
}

export function InvoiceBuilder({
  invoiceId,
  job,
  client,
  tenant,
  catalogItems,
  initial,
  issue,
  deductions = [],
  depositFor,
}: {
  /** "Less: deposit" lines worked out on the server. Read-only here; recalculated on every save. */
  deductions?: { description: string; unitPriceCents: number; taxRateBp: number }[];
  /** Set on a deposit invoice: the quote it's the deposit for. */
  depositFor?: { id: string; number: string };
  invoiceId?: string;
  /** Only for a saved draft: today, and today + the business's payment terms, as "YYYY-MM-DD". */
  issue?: { today: string; defaultDueDate: string; isTaxInvoice: boolean };
  /** Set when this invoice was created from a job — shown for context, never editable here. */
  job?: { id: string; number: string };
  client: { id: string; name: string; properties: { id: string; label: string }[] };
  tenant: { vatRegistered: boolean; defaultTaxRateBp: number; currencyCode: string; invoiceTerms: string | null };
  catalogItems: CatalogItemOption[];
  initial?: {
    notes: string;
    propertyId: string | null;
    lines: LineRow[];
  };
}) {
  const router = useRouter();
  const isEdit = !!invoiceId;
  const [state, action, pending] = useActionState<FormState, FormData>(isEdit ? updateInvoiceAction : createInvoiceAction, undefined);

  const [notes, setNotes] = useState(initial?.notes ?? tenant.invoiceTerms ?? '');
  const [propertyId, setPropertyId] = useState(initial?.propertyId ?? client.properties[0]?.id ?? '');
  const [lines, setLines] = useState<LineRow[]>(initial?.lines?.length ? initial.lines : [blankLine()]);
  const [catalogPick, setCatalogPick] = useState('');
  const [dueDate, setDueDate] = useState(issue?.defaultDueDate ?? '');

  const e = state?.fieldErrors;

  // Submitting through a handler rather than <form action> skips React's
  // automatic form reset, which would snap the controlled property <select>
  // back to its first option and drop the property on the next save.
  // Until the page is interactive the handler isn't attached, and a tap would
  // do a plain browser submit instead, so keep the buttons disabled till then.
  const interactive = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const busy = pending || !interactive;

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const formData = new FormData(ev.currentTarget, (ev.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(formData));
  }

  function updateLine(key: string, patch: Partial<LineRow>) {
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeLine(key: string) {
    setLines((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  function addBlankLine() {
    setLines((rows) => [...rows, blankLine()]);
  }

  function addFromCatalog(itemId: string) {
    const item = catalogItems.find((c) => c.id === itemId);
    if (!item) return;
    setLines((rows) => [
      ...rows,
      {
        key: crypto.randomUUID(),
        catalogItemId: item.id,
        type: item.type,
        description: item.name,
        quantity: '1',
        unitCostRands: item.unitCostCents ? (item.unitCostCents / 100).toFixed(2) : '',
        unitPriceRands: (item.unitPriceCents / 100).toFixed(2),
        taxable: item.taxable,
      },
    ]);
    setCatalogPick('');
  }

  const moneyLines = lines.map((row) => toMoneyLine(row, tenant.vatRegistered, tenant.defaultTaxRateBp));
  // Internal cost and margin are for this invoice's work only; the deposit was billed separately.
  const workTotals = documentTotals(moneyLines);
  const totals = documentTotals([...moneyLines, ...deductions.map((l) => ({ quantity: 1, unitPriceCents: l.unitPriceCents, taxRateBp: l.taxRateBp }))]);
  const linesJson = JSON.stringify(
    lines.map((row) => ({
      catalogItemId: row.catalogItemId || undefined,
      type: row.type,
      description: row.description.trim(),
      quantity: parseFloat(row.quantity) || 0,
      unitCostCents: parseMoneyInput(row.unitCostRands) ?? 0,
      unitPriceCents: parseMoneyInput(row.unitPriceRands) ?? 0,
      taxable: row.taxable,
    }))
  );

  return (
    <form onSubmit={handleSubmit}>
      {isEdit && <input type="hidden" name="id" value={invoiceId} />}
      <input type="hidden" name="clientId" value={client.id} />
      <input type="hidden" name="linesJson" value={linesJson} />

      <FormMessage error={state?.error} ok={state?.ok} />

      <div className="mb-6 rounded-xl border border-slate-800 p-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Client</div>
            <div className="font-medium text-slate-100">{client.name}</div>
          </div>
          {job && <div className="text-sm text-slate-400">From job {job.number}</div>}
          {depositFor && <div className="text-sm text-slate-400">Deposit for quote {depositFor.number}</div>}
        </div>

        {client.properties.length > 0 && (
          <Select label="Property (optional)" name="propertyId" value={propertyId} onChange={(ev) => setPropertyId(ev.target.value)}>
            <option value="">No specific property</option>
            {client.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="mb-6 rounded-xl border border-slate-800 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Lines</h2>
        </div>

        <div className="space-y-3">
          {lines.map((row) => (
            <div key={row.key} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div className="mb-2 grid grid-cols-[7rem_1fr_auto] gap-2">
                <select
                  value={row.type}
                  onChange={(ev) => updateLine(row.key, { type: ev.target.value as CatalogItemType })}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
                >
                  {Object.entries(CATALOG_ITEM_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  value={row.description}
                  onChange={(ev) => updateLine(row.key, { description: ev.target.value })}
                  placeholder="Description"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeLine(row.key)}
                  className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-800 hover:text-red-400"
                  aria-label="Remove line"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input
                  value={row.quantity}
                  onChange={(ev) => updateLine(row.key, { quantity: ev.target.value })}
                  placeholder="Qty"
                  inputMode="decimal"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />
                <input
                  value={row.unitCostRands}
                  onChange={(ev) => updateLine(row.key, { unitCostRands: ev.target.value })}
                  placeholder="Cost"
                  inputMode="decimal"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />
                <input
                  value={row.unitPriceRands}
                  onChange={(ev) => updateLine(row.key, { unitPriceRands: ev.target.value })}
                  placeholder="Price"
                  inputMode="decimal"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />
                <label className="flex items-center gap-1 px-1 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={row.taxable}
                    onChange={(ev) => updateLine(row.key, { taxable: ev.target.checked })}
                    className="h-4 w-4 rounded"
                  />
                  VAT
                </label>
              </div>
            </div>
          ))}
        </div>

        {deductions.length > 0 && (
          <div className="mt-3 space-y-2">
            {deductions.map((l, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-dashed border-slate-700 px-3 py-2 text-sm">
                <span className="text-slate-300">
                  {l.description}
                  {tenant.vatRegistered && <span className="ml-2 text-xs text-slate-500">VAT {l.taxRateBp / 100}%</span>}
                </span>
                <span className="tabular-nums text-slate-300">{formatMoney(l.unitPriceCents, tenant.currencyCode)}</span>
              </div>
            ))}
            <p className="text-xs text-slate-500">
              The deposit already invoiced on this job is deducted automatically, at the VAT rate it was charged at, so VAT isn&apos;t charged twice.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addBlankLine}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            + Custom line
          </button>
          {catalogItems.length > 0 && (
            <select
              value={catalogPick}
              onChange={(ev) => addFromCatalog(ev.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-amber-400 focus:outline-none"
            >
              <option value="">+ Add from price list…</option>
              {catalogItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({formatMoney(item.unitPriceCents, tenant.currencyCode)})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <TextArea label="Notes for the client (printed on the invoice)" name="notes" value={notes} onChange={(ev) => setNotes(ev.target.value)} errors={e?.notes} />

      <div className="mb-6 rounded-xl border border-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Totals (shown to client)</h2>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-300">
            <span>Subtotal</span>
            <span>{formatMoney(totals.subtotalCents, tenant.currencyCode)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>VAT</span>
            <span>{formatMoney(totals.taxCents, tenant.currencyCode)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-1 font-semibold text-slate-100">
            <span>Total</span>
            <span>{formatMoney(totals.totalCents, tenant.currencyCode)}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-dashed border-slate-700 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Internal only — never shown to the client</h2>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Cost</span>
            <span>{formatMoney(workTotals.costCents, tenant.currencyCode)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Gross profit</span>
            <span>{formatMoney(workTotals.profitCents, tenant.currencyCode)}</span>
          </div>
          <div className="flex justify-between font-medium text-emerald-400">
            <span>Margin</span>
            <span>{workTotals.marginPercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <SubmitButton pending={busy}>{isEdit ? 'Save draft' : 'Create invoice'}</SubmitButton>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>

      {issue && (
        <div className="mt-8 rounded-xl border border-amber-800/60 bg-amber-500/5 p-4">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-amber-300">Issue this invoice</h2>
          <p className="mb-3 text-xs text-slate-400">
            Issuing gives it the next {issue.isTaxInvoice ? 'tax invoice' : 'invoice'} number and locks it for good. After
            that, mistakes are corrected with a credit note.
          </p>
          <Field
            label="Payment due"
            name="dueDate"
            type="date"
            min={issue.today}
            value={dueDate}
            onChange={(ev) => setDueDate(ev.target.value)}
            errors={e?.dueDate}
            hint={dueDate === issue.today ? 'Due on receipt.' : undefined}
          />
          <button
            type="submit"
            name="intent"
            value="issue"
            disabled={busy}
            onClick={(ev) => {
              if (!window.confirm('Issue this invoice? It gets its number and can no longer be edited.')) ev.preventDefault();
            }}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
          >
            Save &amp; issue invoice
          </button>
        </div>
      )}
    </form>
  );
}
