'use client';

import { useRef, useTransition } from 'react';
import { markRecipientSentAction } from '@/lib/messaging/actions';

const SKIP_REASON_LABEL: Record<string, string> = {
  opted_out: 'Skipped — opted out',
  no_phone: 'Skipped — no phone',
  no_email: 'Skipped — no email',
};

export function SendListItem({
  recipientId,
  broadcastId,
  name,
  phone,
  message,
  status,
  skipReason,
  sentAt,
}: {
  recipientId: string;
  broadcastId: string;
  name: string;
  phone: string | null;
  message: string;
  status: 'PENDING' | 'SENT' | 'SKIPPED' | 'FAILED';
  skipReason: string | null;
  sentAt: Date | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const waHref = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : undefined;

  function handleTap() {
    if (!waHref) return;
    window.open(waHref, '_blank', 'noopener,noreferrer');
    startTransition(() => formRef.current?.requestSubmit());
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-3 last:border-0">
      <span className="text-sm text-slate-200">{name}</span>
      {status === 'SENT' ? (
        <span className="rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Sent{sentAt && ` · ${sentAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} ${sentAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`}
        </span>
      ) : status === 'SKIPPED' ? (
        <span className="rounded-md bg-slate-800 px-3 py-1 text-xs text-slate-500">{SKIP_REASON_LABEL[skipReason ?? ''] ?? 'Skipped'}</span>
      ) : waHref ? (
        <button
          type="button"
          onClick={handleTap}
          disabled={isPending}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          Send via WhatsApp
        </button>
      ) : (
        <span className="text-xs text-slate-500">No phone</span>
      )}
      <form ref={formRef} action={markRecipientSentAction} className="hidden">
        <input type="hidden" name="recipientId" value={recipientId} />
        <input type="hidden" name="broadcastId" value={broadcastId} />
      </form>
    </div>
  );
}
