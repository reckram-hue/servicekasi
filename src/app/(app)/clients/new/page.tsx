import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { NewClientForm } from '@/components/clients/NewClientForm';

export default async function NewClientPage() {
  const { tenant } = await requireRole();
  const mobileCarWash = tenant.industry === 'MOBILE_CAR_WASH';
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-xl">
        <Link href="/clients" className="text-sm text-amber-400 hover:underline">← Clients</Link>
        <h1 className="mt-3 mb-2 text-2xl font-bold">Add {mobileCarWash ? 'customer' : 'client'}</h1>
        <p className="mb-6 text-sm text-slate-400">Save their contact details for {tenant.businessName}, then schedule {mobileCarWash ? 'a wash' : 'a job'} or create an invoice.</p>
        <NewClientForm mobileCarWash={mobileCarWash} />
      </div>
    </div>
  );
}
