"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  INITIAL_USERS,
  INITIAL_CLIENTS,
  INITIAL_JOBS,
  INITIAL_INVOICES,
} from "@/data/mockData";
import { formatMoney } from "@/lib/money";

// Dynamically import AdminDashboard with SSR disabled to satisfy Leaflet
const AdminDashboard = dynamic(
  () => import("@/components/AdminDashboard").then((mod) => mod.AdminDashboard),
  { ssr: false }
);

type AppShellProps = {
  moneyOwed?: { outstandingCents: number; overdueCents: number; overdueCount: number; currencyCode: string };
};

/** The dashboard's own content — the sidebar and page chrome around it live in the shared (app) layout. */
export function AppShell({ moneyOwed }: AppShellProps) {
  const jobs = INITIAL_JOBS;
  const clients = INITIAL_CLIENTS;
  const technicians = INITIAL_USERS.filter((u) => u.role === "TECHNICIAN");
  const invoices = INITIAL_INVOICES;

  return (
    <div className="p-6">
      {moneyOwed && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">Outstanding</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-100">
              {formatMoney(moneyOwed.outstandingCents, moneyOwed.currencyCode)}
            </div>
          </div>
          <Link href="/invoices/overdue" className="rounded-xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500">Overdue</div>
            <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${moneyOwed.overdueCents > 0 ? 'text-red-400' : 'text-slate-100'}`}>
              {formatMoney(moneyOwed.overdueCents, moneyOwed.currencyCode)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {moneyOwed.overdueCount === 0
                ? 'Nothing overdue'
                : `${moneyOwed.overdueCount} invoice${moneyOwed.overdueCount === 1 ? '' : 's'} · Send reminders →`}
            </div>
          </Link>
        </div>
      )}
      <AdminDashboard
        jobs={jobs}
        clients={clients}
        technicians={technicians}
        invoices={invoices}
        onUpdateJobStatus={() => {}}
        onAssignTechnician={() => {}}
        onSelectJobForTechView={() => {}}
        onSelectInvoice={() => {}}
        onCreateInvoiceForJob={() => {}}
        onOpenNewJobModal={() => {}}
      />
    </div>
  );
}
