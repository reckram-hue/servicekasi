import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { InvoiceBuilder } from '@/components/invoices/InvoiceBuilder';

function displayName(c: { firstName: string; lastName: string | null; companyName: string | null }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return c.companyName ? `${name} (${c.companyName})` : name;
}

function propertyLabel(p: { street: string; suburb: string | null; city: string }) {
  return [p.street, p.suburb, p.city].filter(Boolean).join(', ');
}

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { tenant } = await requireRole();
  const { client: clientId } = await searchParams;
  if (!clientId) redirect('/clients');

  const db = tenantDb(tenant.id);
  const [client, catalogItems] = await Promise.all([
    db.client.findUnique({ where: { id: clientId }, include: { properties: true } }),
    db.catalogItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);
  if (!client) redirect('/clients');

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/invoices" className="text-sm text-amber-400 hover:underline">
          ← Invoices
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">New invoice</h1>
        <InvoiceBuilder
          client={{
            id: client.id,
            name: displayName(client),
            properties: client.properties.map((p) => ({ id: p.id, label: propertyLabel(p) })),
          }}
          tenant={{
            vatRegistered: tenant.vatRegistered,
            defaultTaxRateBp: tenant.defaultTaxRateBp,
            currencyCode: tenant.currencyCode,
            invoiceTerms: tenant.invoiceTerms,
          }}
          catalogItems={catalogItems}
        />
      </div>
    </div>
  );
}
