'use client';

import { useState, useTransition } from 'react';
import { startOnlinePaymentAction } from '@/lib/payments/actions';

/** Asks the server for a signed checkout, then posts the browser to the provider's payment page. */
export function PayNowButton({ publicToken, label }: { publicToken: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay() {
    setError(null);
    startTransition(async () => {
      const result = await startOnlinePaymentAction(publicToken);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = result.action;
      for (const [name, value] of result.fields) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={pay}
        disabled={pending}
        className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
      >
        {pending ? 'Opening secure checkout…' : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
