'use client';

import { startTransition, useActionState, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import type { CatalogItemType } from '@prisma/client';
import { createQuoteAction, updateQuoteAction, type FormState } from '@/lib/quotes/actions';
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
  optional: boolean;
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
    optional: false,
  };
}

function toMoneyLine(row: LineRow, vatRegistered: boolean, defaultTaxRateBp: number): MoneyLineInput {
  return {
    quantity: parseFloat(row.quantity) || 0,
    unitPriceCents: parseMoneyInput(row.unitPriceRands) ?? 0,
    unitCostCents: parseMoneyInput(row.unitCostRands) ?? 0,
    taxRateBp: vatRegistered && row.taxable ? defaultTaxRateBp : 0,
    optional: row.optional,
    selected: true,
  };
}

export function QuoteBuilder({
  quoteId,
  quoteNumber,
  client,
  tenant,
  catalogItems,
  defaultValidUntil,
  initial,
}: {
  quoteId?: string;
  quoteNumber?: string;
  client: { id: string; name: string; properties: { id: string; label: string }[] };
  tenant: { vatRegistered: boolean; defaultTaxRateBp: number; currencyCode: string; defaultQuoteValidDays: number; quoteTerms: string | null };
  catalogItems: CatalogItemOption[];
  /** Today + the tenant's default quote validity, as "YYYY-MM-DD". Computed server-side. */
  defaultValidUntil: string;
  initial?: {
    title: string;
    notes: string;
    validUntil: string;
    depositPercent: number | null;
    propertyId: string | null;
    lines: LineRow[];
  };
}) {
  const router = useRouter();
  const isEdit = !!quoteId;
  const [state, action, pending] = useActionState<FormState, FormData>(isEdit ? updateQuoteAction : createQuoteAction, undefined);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? tenant.quoteTerms ?? '');
  const [propertyId, setPropertyId] = useState(initial?.propertyId ?? client.properties[0]?.id ?? '');
  const [depositPercent, setDepositPercent] = useState(initial?.depositPercent ? String(initial.depositPercent) : '');
  const [validUntil, setValidUntil] = useState(initial?.validUntil ?? defaultValidUntil);
  const [lines, setLines] = useState<LineRow[]>(initial?.lines?.length ? initial.lines : [blankLine()]);
  const [catalogPick, setCatalogPick] = useState('');

  const e = state?.fieldErrors;

  // Submitting through a handler rather than <form action> skips React's
  // automatic form reset, which would snap the controlled property <select>
  // back to its first option and drop the property on the next save.
  // Until the page is interactive the handler isn't attached, and a tap would
  // do a plain browser submit instead, so keep the buttons disabled till then.
  const noopSubscribe = () => () => {};
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
        optional: false,
      },
    ]);
    setCatalogPick('');
  }

  const moneyLines = lines.map((row) => toMoneyLine(row, tenant.vatRegistered, tenant.defaultTaxRateBp));
  const totals = documentTotals(moneyLines);
  const depositCents = depositPercent ? Math.round((totals.totalCents * (parseInt(depositPercent, 10) || 0)) / 100) : 0;
  const linesJson = JSON.stringify(
    lines.map((row) => ({
      catalogItemId: row.catalogItemId || undefined,
      type: row.type,
      description: row.description.trim(),
      quantity: parseFloat(row.quantity) || 0,
      unitCostCents: parseMoneyInput(row.unitCostRands) ?? 0,
      unitPriceCents: parseMoneyInput(row.unitPriceRands) ?? 0,
      taxable: row.taxable,
      optional: row.optional,
    }))
  );

  return (
    <form onSubmit={handleSubmit}>
      {isEdit && <input type="hidden" name="id" value={quoteId} />}
      <input type="hidden" name="clientId" value={client.id} />
      <input type="hidden" name="linesJson" value={linesJson} />

      <FormMessage error={state?.error} ok={state?.ok} />

      <div className="mb-6 rounded-xl border border-slate-800 p-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Client</div>
            <div className="font-medium text-slate-100">{client.name}</div>
          </div>
          {quoteNumber && <div className="text-sm text-slate-400">{quoteNumber}</div>}
        </div>

        <Field
          label="Title"
          name="title"
          required
          value={title}
          onChange={(ev) => setTitle(ev.target.value)}
          errors={e?.title}
          placeholder="e.g. Geyser replacement"
        />

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

        <div className="grid grid-cols-2 gap-x-3">
          <Field
            label="Valid until"
            name="validUntil"
            type="date"
            value={validUntil}
            onChange={(ev) => setValidUntil(ev.target.value)}
            errors={e?.validUntil}
          />
          <Field
            label="Deposit required (%)"
            name="depositPercent"
            type="number"
            min={0}
            max={100}
            placeholder="0"
            value={depositPercent}
            onChange={(ev) => setDepositPercent(ev.target.value)}
            errors={e?.depositPercent}
          />
        </div>
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
                <div className="flex items-center gap-3 px-1 text-xs text-slate-400">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={row.optional}
                      onChange={(ev) => updateLine(row.key, { optional: ev.target.checked })}
                      className="h-4 w-4 rounded"
                    />
                    Optional
                  </label>
                  <label className="flex items-center gap-1">
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
            </div>
          ))}
        </div>

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

      <TextArea label="Notes for the client (optional)" name="notes" value={notes} onChange={(ev) => setNotes(ev.target.value)} errors={e?.notes} />

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
          {depositCents > 0 && (
            <div className="flex justify-between text-amber-400">
              <span>Deposit ({depositPercent}%)</span>
              <span>{formatMoney(depositCents, tenant.currencyCode)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-dashed border-slate-700 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Internal only — never shown to the client</h2>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Cost</span>
            <span>{formatMoney(totals.costCents, tenant.currencyCode)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Gross profit</span>
            <span>{formatMoney(totals.profitCents, tenant.currencyCode)}</span>
          </div>
          <div className="flex justify-between font-medium text-emerald-400">
            <span>Margin</span>
            <span>{totals.marginPercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <SubmitButton pending={busy}>{isEdit ? 'Save changes' : 'Create quote'}</SubmitButton>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
