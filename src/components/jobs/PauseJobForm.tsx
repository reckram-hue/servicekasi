'use client';

import { pauseJobAction } from '@/lib/jobs/actions';

/** Sets a job aside without cancelling it — e.g. the technician is pulled onto an emergency. */
export function PauseJobForm({ jobId }: { jobId: string }) {
  return (
    <form action={pauseJobAction} className="mt-2 space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <textarea
        name="reason"
        placeholder="Why? (optional) e.g. Waiting on parts, technician diverted to an emergency"
        rows={2}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
      />
      <button type="submit" className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700">
        Pause job
      </button>
    </form>
  );
}
