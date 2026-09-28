import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { ImportClientsForm } from '@/components/clients/ImportClientsForm';

export default async function ImportClientsPage() {
  await requireRole();

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/clients" className="text-sm text-amber-400 hover:underline">
          ← Clients
        </Link>
        <h1 className="mt-2 mb-1 text-2xl font-bold">Import clients</h1>
        <p className="mb-4 text-sm text-slate-500">
          Bring your existing client list in from a spreadsheet, all at once.
        </p>
        <a
          href="/templates/servicekasi-clients-template.csv"
          download
          className="mb-6 inline-block rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
        >
          ⬇ Download the template
        </a>
        <ImportClientsForm />
        <p className="mt-6 text-xs text-slate-500">
          A row already matching one of your clients by phone or email is skipped, so this is safe to run more than once.
        </p>
      </div>
    </div>
  );
}
