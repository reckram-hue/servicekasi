'use client';

import { useActionState, useState } from 'react';
import { addVisitAction, updateVisitAction, type FormState } from '@/lib/jobs/actions';
import { FormMessage, SubmitButton } from '@/components/auth/ui';
import { TechnicianPicker } from '@/components/jobs/TechnicianPicker';
import { DateInput, TimeInput } from '@/components/ui/DateTimeInputs';

const INPUT = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 focus:border-amber-400 focus:outline-none';

type ExistingVisit = { id: string; date: string; startTime: string; endTime: string; technicianIds: string[]; instructions: string };

/** Adds a one-off visit to a job, or — given `visit` — edits that one visit. */
export function AddVisitForm({
  jobId,
  technicians,
  defaultDate,
  visit,
  mobileCarWash = false,
}: {
  jobId: string;
  technicians: { id: string; name: string }[];
  defaultDate: string;
  visit?: ExistingVisit;
  mobileCarWash?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(visit ? updateVisitAction : addVisitAction, undefined);
  const [selected, setSelected] = useState<string[]>(visit?.technicianIds ?? []);

  return (
    <form action={action} className={visit ? 'mt-3' : 'rounded-xl border border-slate-800 p-4'}>
      {visit ? <input type="hidden" name="visitId" value={visit.id} /> : <input type="hidden" name="jobId" value={jobId} />}
      <input type="hidden" name="technicianIdsJson" value={JSON.stringify(selected)} />
      {!visit && <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">{mobileCarWash ? 'Schedule a wash visit' : 'Add a one-off visit'}</h2>}
      <FormMessage error={state?.error} ok={state?.ok} />
      {state?.fieldErrors && <p role="alert" className="mb-3 text-sm text-red-300">{Object.values(state.fieldErrors).flat().filter(Boolean).join(' ')}</p>}

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Date</span>
          <DateInput name="date" defaultValue={visit?.date ?? defaultDate} required className={INPUT} />
        </label>
        <TimeInput label="Start" name="startTime" defaultValue={visit?.startTime} required />
        <TimeInput label="End" name="endTime" defaultValue={visit?.endTime} required />
      </div>

      <TechnicianPicker technicians={technicians} selected={selected} onChange={setSelected} mobileCarWash={mobileCarWash} />

      <label className="mb-4 block">
        <span className="mb-1 block text-sm text-slate-300">{mobileCarWash ? 'Instructions for the wash team (optional)' : 'Instructions for the technician (optional)'}</span>
        <textarea name="instructions" rows={2} maxLength={2000} defaultValue={visit?.instructions} className={INPUT} />
      </label>

      <SubmitButton pending={pending}>{visit ? 'Save this visit' : 'Schedule visit'}</SubmitButton>
    </form>
  );
}
