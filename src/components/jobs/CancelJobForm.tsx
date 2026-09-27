'use client';

import { cancelJobAction } from '@/lib/jobs/actions';

/** Cancels the whole job. Every visit that hasn't happened yet is cancelled with it. */
export function CancelJobForm({ jobId }: { jobId: string }) {
  return (
    <form action={cancelJobAction} className="mt-2 space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <textarea
        name="reason"
        placeholder="Why? (optional) e.g. Client cancelled, no longer needed"
        rows={2}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-red-400 focus:outline-none"
      />
      <button
        type="submit"
        onClick={(ev) => {
          if (!window.confirm('Cancel this job? Every visit that hasn’t happened yet will be cancelled too.')) {
            ev.preventDefault();
          }
        }}
        className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
      >
        Cancel job
      </button>
    </form>
  );
}
