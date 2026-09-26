'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  createCatalogItemAction,
  toggleActiveCatalogItemAction,
  updateCatalogItemAction,
  type FormState,
} from '@/lib/priceList/actions';
import { formatMoney } from '@/lib/money';
import { FormMessage, SubmitButton } from '@/components/auth/ui';
import { Modal } from '@/components/ui/Modal';
import { CatalogItemFormFields } from './CatalogItemFormFields';

export type CatalogItemRow = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  unitCostCents: number;
  unitPriceCents: number;
  taxable: boolean;
  active: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  SERVICE: 'Service',
  MATERIAL: 'Material',
  CALLOUT: 'Call-out fee',
  TRAVEL: 'Travel',
  LABOUR: 'Labour',
};

function rands(cents: number): string {
  return (cents / 100).toFixed(2);
}

// ───────────────────────── add ─────────────────────────

function AddItemButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createCatalogItemAction, undefined);

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
        + Add item
      </button>
      {open && (
        <Modal title="Add price list item" onClose={() => setOpen(false)}>
          <form action={action}>
            <FormMessage error={state?.error} ok={state?.ok} />
            <CatalogItemFormFields errors={state?.fieldErrors} />
            <SubmitButton pending={pending}>Add item</SubmitButton>
          </form>
        </Modal>
      )}
    </>
  );
}

// ───────────────────────── edit ─────────────────────────

function EditItemModal({ item, onClose }: { item: CatalogItemRow; onClose: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCatalogItemAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 800);
      return () => clearTimeout(t);
    }
  }, [state?.ok, onClose]);

  return (
    <Modal title={`Edit ${item.name}`} onClose={onClose}>
      <form action={action}>
        <input type="hidden" name="id" value={item.id} />
        <FormMessage error={state?.error} ok={state?.ok} />
        <CatalogItemFormFields
          errors={state?.fieldErrors}
          defaults={{
            type: item.type,
            name: item.name,
            description: item.description ?? undefined,
            unitCostRands: item.unitCostCents ? rands(item.unitCostCents) : '',
            unitPriceRands: rands(item.unitPriceCents),
            taxable: item.taxable,
          }}
        />
        <SubmitButton pending={pending}>Save changes</SubmitButton>
      </form>
    </Modal>
  );
}

// ───────────────────────── active toggle ─────────────────────────

function ActiveToggle({ item }: { item: CatalogItemRow }) {
  return (
    <form action={toggleActiveCatalogItemAction}>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="active" value={String(item.active)} />
      <button
        type="submit"
        className={`rounded-md px-3 py-1 text-xs font-medium ${
          item.active ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
        }`}
      >
        {item.active ? 'Deactivate' : 'Activate'}
      </button>
    </form>
  );
}

// ───────────────────────── page ─────────────────────────

export function PriceListPageClient({ items, currencyCode }: { items: CatalogItemRow[]; currencyCode: string }) {
  const [editing, setEditing] = useState<CatalogItemRow | null>(null);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Services, materials and call-out fees you can pick from when building a quote.</p>
        <AddItemButton />
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500">
          No price list items yet. Add your first one to get started.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4 last:border-0 ${item.active ? '' : 'opacity-50'}`}
            >
              <div>
                <div className="font-medium text-slate-100">
                  {item.name}
                  <span className="ml-2 text-xs text-slate-500">{TYPE_LABELS[item.type] ?? item.type}</span>
                  {!item.taxable && <span className="ml-2 text-xs text-slate-500">no VAT</span>}
                </div>
                <div className="text-xs text-slate-400">
                  {formatMoney(item.unitPriceCents, currencyCode)} excl. VAT
                  {item.unitCostCents > 0 && <> · cost {formatMoney(item.unitCostCents, currencyCode)}</>}
                  {item.description && <> · {item.description}</>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(item)}
                  className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  Edit
                </button>
                <ActiveToggle item={item} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <EditItemModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
