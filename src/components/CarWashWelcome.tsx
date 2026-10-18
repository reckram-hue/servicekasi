import Link from 'next/link';
import { CarFront, CalendarDays, Receipt, Wallet } from 'lucide-react';

export function CarWashWelcome({ businessName, logoUrl }: { businessName: string; logoUrl: string | null }) {
  return <section className="mb-6 rounded-2xl border border-cyan-800/60 bg-cyan-950/30 p-5 sm:p-7">
    <div className="flex items-center gap-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-16 w-20 rounded-lg bg-white object-contain p-1" />
      ) : <CarFront aria-hidden="true" className="h-12 w-12 shrink-0 text-cyan-300" />}
      <div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Mobile car wash</p>
        <h1 className="mt-1 text-2xl font-bold text-white">{businessName}</h1>
        <p className="mt-1 text-sm text-slate-300">Your washes, customers and wash team in one place.</p></div>
    </div>
    <div className="mt-5 flex flex-wrap gap-3">
      <Link href="/schedule" className="flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950"><CalendarDays className="h-4 w-4" />Open wash planner</Link>
      <Link href="/jobs" className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-white"><CarFront className="h-4 w-4" />Add a wash</Link>
      <Link href="/invoices" className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-white"><Receipt className="h-4 w-4" />Invoices</Link>
      <Link href="/bookkeeping/expenses/new" className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-white"><Wallet className="h-4 w-4" />Log a cost</Link>
    </div>
  </section>;
}
