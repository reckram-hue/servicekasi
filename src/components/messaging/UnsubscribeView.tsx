'use client';

import { useActionState } from 'react';
import { unsubscribeAction, undoUnsubscribeAction, type PublicFormState } from '@/lib/messaging/publicActions';

export function UnsubscribeView({
  token,
  firstName,
  businessName,
  alreadyOptedOut,
}: {
  token: string;
  firstName: string;
  businessName: string;
  alreadyOptedOut: boolean;
}) {
  const [unsubState, unsubAction, unsubPending] = useActionState<PublicFormState, FormData>(unsubscribeAction, undefined);
  const [undoState, undoAction, undoPending] = useActionState<PublicFormState, FormData>(undoUnsubscribeAction, undefined);

  const isOptedOut = undoState?.ok ? false : unsubState?.ok ? true : alreadyOptedOut;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
      {isOptedOut ? (
        <>
          <p className="font-semibold text-slate-100">
            You won&apos;t get promotions from {businessName} again, {firstName}.
          </p>
          <p className="mt-1 text-sm text-slate-400">You&apos;ll still hear from them about work they&apos;re doing for you.</p>
          <form action={undoAction} className="mt-4">
            <input type="hidden" name="token" value={token} />
            {undoState?.error && <p className="mb-3 text-sm text-red-400">{undoState.error}</p>}
            <button
              type="submit"
              disabled={undoPending}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-60"
            >
              {undoPending ? 'Please wait…' : "Changed your mind? Opt back in"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-slate-100">
            Hi {firstName}, stop getting promotions from {businessName}?
          </p>
          <p className="mt-1 text-sm text-slate-400">You&apos;ll still hear from them about work they&apos;re doing for you.</p>
          <form action={unsubAction} className="mt-4">
            <input type="hidden" name="token" value={token} />
            {unsubState?.error && <p className="mb-3 text-sm text-red-400">{unsubState.error}</p>}
            <button
              type="submit"
              disabled={unsubPending}
              className="rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {unsubPending ? 'Please wait…' : 'Yes, stop promotions'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
