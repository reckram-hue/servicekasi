'use client';

import { useActionState, useState } from 'react';
import { setRecurrenceAction, type FormState } from '@/lib/jobs/actions';
import { buildRule, describeRule, occurrences, type RecurrencePattern } from '@/lib/recurrence';
import { publicHolidayName } from '@/lib/holidays';
import { addDaysToDateStr, formatDateStr } from '@/lib/dates';
import { FormMessage, SubmitButton } from '@/components/auth/ui';
import { TechnicianPicker } from '@/components/jobs/TechnicianPicker';

const INPUT = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 focus:border-amber-400 focus:outline-none';
const PATTERNS: RecurrencePattern[] = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY_DATE', 'MONTHLY_WEEKDAY'];
const PREVIEW_COUNT = 6;

export type CurrentRecurrence = {
  pattern: RecurrencePattern;
  firstDate: string;
  startTime: string;
  endTime: string;
  endsOn: string;
  technicianIds: string[];
  instructions: string;
};

export function RecurrenceForm({
  jobId,
  technicians,
  today,
  countryCode,
  current,
}: {
  jobId: string;
  technicians: { id: string; name: string }[];
  today: string;
  countryCode: string;
  current?: CurrentRecurrence;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(setRecurrenceAction, undefined);
  const [pattern, setPattern] = useState<RecurrencePattern>(current?.pattern ?? 'WEEKLY');
  const [firstDate, setFirstDate] = useState(current?.firstDate ?? today);
  const [endsOn, setEndsOn] = useState(current?.endsOn ?? '');
  const [selected, setSelected] = useState<string[]>(current?.technicianIds ?? []);

  const built = buildRule(pattern, firstDate);
  const previewFrom = firstDate > today ? firstDate : today;
  const previewTo = endsOn && endsOn < addDaysToDateStr(previewFrom, 400) ? endsOn : addDaysToDateStr(previewFrom, 400);
  const preview = 'rule' in built ? occurrences(built.rule, firstDate, previewFrom, previewTo).slice(0, PREVIEW_COUNT) : [];

  return (
    <form action={action}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="technicianIdsJson" value={JSON.stringify(selected)} />
      <FormMessage error={state?.error} ok={state?.ok} />

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">First visit</span>
          <input name="firstDate" type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} required className={INPUT} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">How often</span>
          <select name="pattern" value={pattern} onChange={(e) => setPattern(e.target.value as RecurrencePattern)} className={INPUT}>
            {PATTERNS.map((p) => {
              const r = buildRule(p, firstDate);
              return (
                <option key={p} value={p}>
                  {'rule' in r ? describeRule(r.rule) : 'Monthly on this date (not possible)'}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Start</span>
          <input name="startTime" type="time" defaultValue={current?.startTime} required className={INPUT} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">End</span>
          <input name="endTime" type="time" defaultValue={current?.endTime} required className={INPUT} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">Last date (optional)</span>
          <input name="endsOn" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={INPUT} />
        </label>
      </div>

      <TechnicianPicker technicians={technicians} selected={selected} onChange={setSelected} />

      <label className="mb-3 block">
        <span className="mb-1 block text-sm text-slate-300">Instructions for every visit (optional)</span>
        <textarea name="instructions" rows={2} maxLength={2000} defaultValue={current?.instructions} className={INPUT} />
      </label>

      <div className="mb-4 rounded-lg bg-slate-800/50 p-3 text-sm">
        {'error' in built ? (
          <p className="text-red-300">{built.error}</p>
        ) : preview.length === 0 ? (
          <p className="text-slate-400">No visits fall between the first visit and the last date.</p>
        ) : (
          <>
            <div className="mb-1 text-slate-400">Next visits:</div>
            <ul className="space-y-0.5">
              {preview.map((date) => {
                const holiday = publicHolidayName(countryCode, date);
                return (
                  <li key={date} className="text-slate-200">
                    {formatDateStr(date)}
                    {holiday && <span className="ml-2 text-amber-300">⚠ {holiday}</span>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {current && (
        <p className="mb-3 text-xs text-slate-500">
          Changing how often or the first visit replaces every future visit that hasn’t started, including skipped ones. Changing
          only the time, technicians or instructions updates future visits and keeps skipped dates skipped.
        </p>
      )}

      <SubmitButton pending={pending}>{current ? 'Update all future visits' : 'Repeat this job'}</SubmitButton>
    </form>
  );
}
