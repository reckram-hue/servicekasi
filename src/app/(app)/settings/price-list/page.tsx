import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { PriceListPageClient } from '@/components/priceList/PriceListPageClient';

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
        <h1 className="mt-2 mb-6 text-2xl font-bold">Price list</h1>
        <PriceListPageClient items={items} currencyCode={tenant.currencyCode} />
      </div>
    </div>
  );
}
