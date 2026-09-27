'use client';

import { useActionState } from 'react';
import { addExpenseCategoryAction, renameExpenseCategoryAction, type FormState } from '@/lib/bookkeeping/actions';
import { Field, FormMessage, SubmitButton } from '@/components/auth/ui';

function CategoryRow({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(renameExpenseCategoryAction, undefined);

  return (
    <form action={action} className="flex items-center gap-2 border-b border-slate-800 p-3 last:border-0">
      <input type="hidden" name="id" value={id} />
      <input
        name="name"
        defaultValue={name}
        className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {state?.error && <span className="text-xs text-red-400">{state.error}</span>}
    </form>
  );
}

export function CategoriesManager({ categories }: { categories: { id: string; name: string }[] }) {
  const [addState, addAction, addPending] = useActionState<FormState, FormData>(addExpenseCategoryAction, undefined);

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900">
        {categories.map((c) => (
          <CategoryRow key={c.id} id={c.id} name={c.name} />
        ))}
      </div>

      <form action={addAction} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Add a category</h2>
        <FormMessage error={addState?.error} ok={addState?.ok} />
        <Field label="Name" name="name" placeholder="e.g. Signage" errors={addState?.fieldErrors?.name} />
        <SubmitButton pending={addPending}>Add category</SubmitButton>
      </form>
    </div>
  );
}
