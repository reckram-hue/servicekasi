'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { createBroadcastAction, previewAudienceAction, type ComposeFormState, type PreviewState } from '@/lib/messaging/actions';
import { looksLikeASale, type RecencyOption } from '@/lib/messaging/schema';
import { SubmitButton } from '@/components/auth/ui';

function AudiencePreview({ preview, pending }: { preview: PreviewState; pending: boolean }) {
  if (!preview) return <p className="text-sm text-slate-500">{pending ? 'Counting…' : 'Working out who this will reach…'}</p>;
  if ('error' in preview) return <p className="text-sm text-red-400">{preview.error}</p>;

  const skippedParts = [
    preview.skippedOptedOut > 0 && `${preview.skippedOptedOut} opted out`,
    preview.skippedNoContact > 0 && `${preview.skippedNoContact} no contact details`,
  ].filter(Boolean);

  return (
    <p className={`text-sm ${pending ? 'opacity-60' : ''}`}>
      This will reach <span className="font-semibold text-slate-100">{preview.total}</span> client{preview.total === 1 ? '' : 's'}
      {skippedParts.length > 0 && <span className="text-slate-500"> ({skippedParts.join(', ')} skipped)</span>}
      .
    </p>
  );
}

export function ComposeBroadcastForm({ places }: { places: string[] }) {
  const [kind, setKind] = useState<'SERVICE_NOTICE' | 'PROMOTION'>('SERVICE_NOTICE');
  const [channel] = useState<'WHATSAPP_LIST' | 'EMAIL'>('WHATSAPP_LIST');
  const [place, setPlace] = useState('');
  const [recency, setRecency] = useState<RecencyOption>('any');
  const [recencyMonths, setRecencyMonths] = useState(6);
  const [body, setBody] = useState('');

  const [preview, setPreview] = useState<PreviewState>(undefined);
  const [previewPending, startPreview] = useTransition();

  useEffect(() => {
    const fd = new FormData();
    fd.set('kind', kind);
    fd.set('channel', channel);
    if (place) fd.set('place', place);
    fd.set('recency', recency);
    if (recency !== 'any') fd.set('recencyMonths', String(recencyMonths));

    const t = setTimeout(() => {
      startPreview(async () => {
        setPreview(await previewAudienceAction(undefined, fd));
      });
    }, 250);
    return () => clearTimeout(t);
  }, [kind, channel, place, recency, recencyMonths]);

  const [state, formAction, pending] = useActionState<ComposeFormState, FormData>(createBroadcastAction, undefined);
  const saleNudge = kind === 'SERVICE_NOTICE' && looksLikeASale(body);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{state.error}</p>}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-300">What kind of message?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['SERVICE_NOTICE', 'PROMOTION'] as const).map((k) => (
            <label
              key={k}
              className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm ${
                kind === k ? 'border-amber-400 bg-amber-500/10 text-amber-200' : 'border-slate-700 bg-slate-950 text-slate-300'
              }`}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {k === 'SERVICE_NOTICE' ? 'Service notice' : 'Promotion'}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {kind === 'PROMOTION'
            ? 'Selling something — always skips clients who opted out, and adds "Reply STOP to opt out" automatically.'
            : "Useful, not selling anything — goes to everyone in the audience below."}
        </p>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Channel</span>
        <input type="hidden" name="channel" value={channel} />
        <select value={channel} disabled className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 opacity-70">
          <option value="WHATSAPP_LIST">WhatsApp send list</option>
        </select>
        <span className="mt-1 block text-xs text-slate-500">Email broadcasts are coming later.</span>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Audience — place</span>
        <select
          name="place"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
        >
          <option value="">Everywhere</option>
          {places.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Audience — recent work</span>
        <select
          name="recency"
          value={recency}
          onChange={(e) => setRecency(e.target.value as RecencyOption)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
        >
          <option value="any">Everyone</option>
          <option value="worked_recent">Had work done in the last… months</option>
          <option value="worked_stale">No work done in the last… months (win-back)</option>
        </select>
      </label>

      {recency !== 'any' && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Months</span>
          <input
            type="number"
            name="recencyMonths"
            min={1}
            max={36}
            value={recencyMonths}
            onChange={(e) => setRecencyMonths(Number(e.target.value) || 1)}
            className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
          />
        </label>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5">
        <AudiencePreview preview={preview} pending={previewPending} />
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Message</span>
        <textarea
          name="body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hi {firstName}, ..."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder-slate-500"
        />
        <span className="mt-1 block text-xs text-slate-500">Use {'{firstName}'} to greet each client by name.</span>
        {state?.fieldErrors?.body?.map((e) => (
          <span key={e} className="mt-1 block text-xs text-red-400">
            {e}
          </span>
        ))}
        {saleNudge && (
          <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            This reads like it might be selling something — consider marking it a Promotion instead, so it carries an opt-out.
          </p>
        )}
        {kind === 'PROMOTION' && <p className="mt-2 text-xs text-slate-500">&ldquo;Reply STOP to opt out of promotions.&rdquo; will be added automatically.</p>}
      </label>

      <SubmitButton pending={pending}>Continue to send list</SubmitButton>
    </form>
  );
}
