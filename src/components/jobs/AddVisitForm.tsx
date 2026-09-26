'use client';

import { useActionState, useState } from 'react';
import { addVisitAction, type FormState } from '@/lib/jobs/actions';
import { FormMessage, SubmitButton } from '@/components/auth/ui';

export function AddVisitForm({
  jobId,
  technicians,
  defaultDate,
}: {
  jobId: string;
  technicians: { id: string; name: string }[];
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addVisitAction, undefined);
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <form action={action} className="rounded-xl border border-slate-800 p-4">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="technicianIdsJson" value={JSON.stringify(selected)} />
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Add visit</h2>
      <FormMessage error={state?.error} ok={state?.ok} />

      <div className="mb-3 grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Date</span>
          <input
            name="date"
            type="date"
            defaultValue={defaultDate}
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 focus:border-amber-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Start</span>
          <input
            name="startTime"
            type="time"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 focus:border-amber-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">End</span>
          <input
            name="endTime"
            type="time"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 focus:border-amber-400 focus:outline-none"
          />
        </label>
      </div>

      {technicians.length === 0 ? (
        <p className="mb-3 text-sm text-slate-500">Add a technician on the Team page before scheduling a visit.</p>
      ) : (
        <div className="mb-3">
          <span className="mb-1 block text-sm text-slate-300">Technician(s)</span>
          <div className="flex flex-wrap gap-2">
            {technicians.map((t) => (
              <label
                key={t.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  selected.includes(t.id) ? 'border-amber-400 bg-amber-500/10 text-amber-300' : 'border-slate-700 text-slate-300'
                }`}
              >
                <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 rounded" />
                {t.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="mb-4 block">
        <span className="mb-1 block text-sm text-slate-300">Instructions for the technician (optional)</span>
        <textarea
          name="instructions"
          rows={2}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
        />
      </label>

      <SubmitButton pending={pending}>Schedule visit</SubmitButton>
    </form>
  );
}
