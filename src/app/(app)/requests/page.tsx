import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { formatDateStr, localDateStr } from '@/lib/dates';
import { openServiceRequests } from '@/lib/requests/queries';
import { dismissRequestAction, addRequestAsClientAction } from '@/lib/requests/actions';
import { VoiceMemoRecorder } from '@/components/requests/VoiceMemoRecorder';

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Added by hand',
  WEB_BOOKING: 'Your booking page',
  WHATSAPP: 'WhatsApp',
  GOOGLE_BUSINESS: 'Google Business',
  PHONE: 'Phone',
  VOICE_MEMO: 'Voice memo',
};

export default async function RequestsPage() {
  const { tenant } = await requireRole();
  const requests = await openServiceRequests(tenantDb(tenant.id));

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-2xl font-bold">Requests</h1>
        <p className="mb-6 text-sm text-slate-500">
          New leads from your{' '}
          <Link href="/settings/business" className="text-amber-400 hover:underline">
            booking page
          </Link>{' '}
          and anywhere else you&rsquo;ve added one.
        </p>

        <VoiceMemoRecorder />

        {requests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500">Nothing new right now.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-100">{r.contactName || 'No name given'}</div>
                    <div className="text-xs text-slate-500">
                      {r.contactPhone} · {SOURCE_LABEL[r.source] ?? r.source} · {formatDateStr(localDateStr(r.createdAt, 'UTC'))}
                      {r.preferredDate && ` · wants ${formatDateStr(localDateStr(r.preferredDate, 'UTC'))}`}
                    </div>
                  </div>
                </div>
                <p className={`whitespace-pre-wrap text-sm text-slate-300 ${r.transcript && r.transcript !== r.description ? 'mb-1' : 'mb-3'}`}>
                  {r.description}
                </p>
                {r.transcript && r.transcript !== r.description && (
                  <p className="mb-3 text-xs italic text-slate-500">Originally said: &ldquo;{r.transcript}&rdquo;</p>
                )}
                <div className="flex gap-2">
                  <form action={addRequestAsClientAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400">
                      Add as client
                    </button>
                  </form>
                  <form action={dismissRequestAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700">
                      Dismiss
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
