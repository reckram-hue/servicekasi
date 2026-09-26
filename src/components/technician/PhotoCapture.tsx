'use client';

import { useState } from 'react';
import type { AttachmentKind } from '@prisma/client';
import { addVisitPhotoAction, deleteAttachmentAction } from '@/lib/jobs/actions';
import { resizeImageToJpeg } from '@/lib/imageResize';

type Kind = 'BEFORE' | 'AFTER' | 'PARTS';
export type PhotoItem = { id: string; url: string; kind: AttachmentKind; uploadedByMembershipId: string | null };

const KIND_LABELS: Record<Kind, string> = { BEFORE: 'Before', AFTER: 'After', PARTS: 'Parts' };
const KIND_BADGE: Record<Kind, string> = {
  BEFORE: 'bg-amber-500/90 text-white',
  AFTER: 'bg-emerald-600/90 text-white',
  PARTS: 'bg-slate-700/90 text-white',
};

/** Lets the technician attach labelled photos while on site. Only shown while the visit is ON_SITE. */
export function PhotoCapture({ visitId, photos, membershipId }: { visitId: string; photos: PhotoItem[]; membershipId: string }) {
  const [kind, setKind] = useState<Kind>('BEFORE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await resizeImageToJpeg(file);
      const fd = new FormData();
      fd.set('visitId', visitId);
      fd.set('kind', kind);
      fd.set('clientGeneratedId', crypto.randomUUID());
      fd.set('photo', blob, 'photo.jpg');
      const result = await addVisitPhotoAction(fd);
      if (result?.error) setError(result.error);
    } catch {
      setError('Could not process that photo. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {photos.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={KIND_LABELS[p.kind as Kind] ?? p.kind} className="h-full w-full object-cover" />
              <span className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${KIND_BADGE[p.kind as Kind] ?? 'bg-slate-700/90 text-white'}`}>
                {KIND_LABELS[p.kind as Kind] ?? p.kind}
              </span>
              {p.uploadedByMembershipId === membershipId && (
                <form action={deleteAttachmentAction} className="absolute right-1 top-1">
                  <input type="hidden" name="attachmentId" value={p.id} />
                  <button
                    type="submit"
                    className="rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white active:opacity-80"
                    aria-label="Delete photo"
                  >
                    ✕
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(['BEFORE', 'AFTER', 'PARTS'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${kind === k ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <label className={`cursor-pointer rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 ${busy ? 'opacity-60' : 'active:opacity-80'}`}>
          {busy ? 'Uploading…' : '📷 Add photo'}
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={busy} className="hidden" />
        </label>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
