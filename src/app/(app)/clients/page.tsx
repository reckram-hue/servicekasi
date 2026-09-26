import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { ClientsPageClient } from '@/components/clients/ClientsPageClient';

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { tenant } = await requireRole();
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const clients = await tenantDb(tenant.id).client.findMany({
    where: query
      ? {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { companyName: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: { properties: true },
    orderBy: [{ archived: 'asc' }, { firstName: 'asc' }],
    take: 200,
  });

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold">Clients — {tenant.businessName}</h1>
        <ClientsPageClient clients={clients} query={query} />
      </div>
    </div>
  );
}
