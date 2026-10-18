import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { PriceListPageClient } from '@/components/priceList/PriceListPageClient';
import { StarterItemsPanel } from '@/components/priceList/StarterItemsPanel';

export default async function PriceListPage() {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);

  const items = await tenantDb(tenant.id).catalogItem.findMany({
    orderBy: [{ active: 'asc' }, { name: 'asc' }],
  });

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/settings/business" className="text-sm text-amber-400 hover:underline">
          ← Business settings
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">{tenant.industry === 'MOBILE_CAR_WASH' ? 'Wash services & prices' : 'Price list'}</h1>
        {tenant.industry === 'MOBILE_CAR_WASH' && <p className="mb-5 rounded-xl border border-cyan-800 bg-cyan-950/40 p-4 text-sm text-cyan-100">Your car-wash starter services begin inactive with zero-price placeholders. Edit each service to set your own price, then choose Activate for the services you offer. You can rename them or add more.</p>}
        <StarterItemsPanel industry={tenant.industry} />
        <PriceListPageClient items={items} currencyCode={tenant.currencyCode} />
      </div>
    </div>
  );
}
