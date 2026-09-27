import Link from 'next/link';
import { Check } from 'lucide-react';
import type { ChecklistItem } from '@/lib/onboarding/checklist';
import { hideOnboardingChecklistAction } from '@/lib/onboarding/actions';

function Row({ item }: { item: ChecklistItem }) {
  return (
    <Link
      href={item.href}
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        item.done ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white hover:border-amber-300'
      }`}
    >
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          item.done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
        }`}
      >
        {item.done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>
      <div className="min-w-0">
        <div className={`text-sm font-medium ${item.done ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}`}>
          {item.label}
          {item.optional && <span className="ml-2 text-xs font-normal text-slate-400">(optional)</span>}
        </div>
        <div className="text-xs text-slate-500">{item.description}</div>
      </div>
    </Link>
  );
}

/** Shown on the dashboard until everything's done or the owner hides it. */
export function GettingStartedCard({ items }: { items: ChecklistItem[] }) {
  const required = items.filter((i) => !i.optional);
  const doneCount = required.filter((i) => i.done).length;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Getting started</h2>
          <p className="text-sm text-slate-500">
            {doneCount} of {required.length} done
          </p>
        </div>
        <form action={hideOnboardingChecklistAction}>
          <button type="submit" className="text-xs font-medium text-slate-400 underline hover:text-slate-600">
            Hide checklist
          </button>
        </form>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <Row key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}
