import { notFound } from 'next/navigation';
import { getTenantForBooking } from '@/lib/requests/publicQuery';
import { PublicBookingForm } from '@/components/booking/PublicBookingForm';

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantForBooking(slug);
  if (!tenant) notFound();

  const businessName = tenant.tradingName || tenant.businessName;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          {tenant.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt={businessName} className="mx-auto mb-3 h-12 w-auto" />
          )}
          <div className="text-xl font-bold text-amber-400">{businessName}</div>
          {(tenant.city || tenant.region) && (
            <div className="mt-1 text-sm text-slate-500">{[tenant.city, tenant.region].filter(Boolean).join(', ')}</div>
          )}
        </div>

        <h1 className="mb-4 text-center text-lg font-semibold text-slate-100">Request a quote</h1>
        <PublicBookingForm slug={slug} businessName={businessName} />

        {tenant.phone && (
          <p className="mt-6 text-center text-sm text-slate-500">
            Prefer to call? <a href={`tel:${tenant.phone}`} className="text-amber-400 hover:underline">{tenant.phone}</a>
          </p>
        )}
      </div>
    </div>
  );
}
