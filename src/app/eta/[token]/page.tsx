import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicVisitByToken } from '@/lib/jobs/publicVisit';
import { formatDateStr, localDateStr, localTimeStr } from '@/lib/dates';

// Personal — a technician's name and photo — so keep it out of search engines.
export const metadata: Metadata = { title: "Who's coming", robots: { index: false, follow: false } };

export default async function WhosComingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const visit = await getPublicVisitByToken(token);
  if (!visit) notFound();

  const { tenant, property } = visit.job;
  const businessName = tenant.tradingName || tenant.businessName;
  const tz = tenant.timezone;
  const date = localDateStr(visit.startsAt, tz);
  const time = localTimeStr(visit.startsAt, tz);
  const suburb = [property?.suburb, property?.city].filter(Boolean).join(', ');
  const technicians = visit.assignments.map((a) => a.membership);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        {tenant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logoUrl} alt={businessName} className="mx-auto mb-4 h-12 object-contain" />
        ) : (
          <div className="mb-4 text-center text-lg font-bold text-slate-100">{businessName}</div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          {technicians.length === 0 ? (
            <p className="text-slate-300">
              A technician from {businessName} is booked for your {suburb ? `${suburb} ` : ''}appointment
              {' '}on {formatDateStr(date)} at {time}.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-400">
                {visit.status === 'EN_ROUTE' ? 'On the way to your appointment' : 'Booked for your appointment'}
                {suburb && ` in ${suburb}`}, {formatDateStr(date)} at {time}
              </p>
              <div className={`grid gap-4 ${technicians.length > 1 ? 'grid-cols-2' : ''}`}>
                {technicians.map((m, i) => (
                  <div key={i}>
                    {m.user.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.user.photoUrl}
                        alt={m.user.name}
                        className="mx-auto mb-2 h-24 w-24 rounded-full border-2 border-slate-700 object-cover"
                      />
                    ) : (
                      <div className="mx-auto mb-2 flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-slate-700 text-2xl font-bold text-slate-500">
                        {m.user.name.charAt(0)}
                      </div>
                    )}
                    <div className="font-semibold text-slate-100">{m.user.name.split(' ')[0]}</div>
                    {m.specialties.length > 0 && <div className="text-xs text-slate-500">{m.specialties.join(', ')}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="mt-6 text-xs text-slate-500">This link is just to help you feel safe about who&apos;s arriving.</p>
        </div>
      </div>
    </div>
  );
}
