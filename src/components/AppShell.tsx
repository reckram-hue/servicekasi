"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { TopHeader } from "@/components/TopHeader";
import {
  INITIAL_USERS,
  INITIAL_CLIENTS,
  INITIAL_JOBS,
  INITIAL_INVOICES,
} from "@/data/mockData";
import { INITIAL_TENANTS } from "@/data/tenantMockData";
import { formatMoney } from "@/lib/money";

// Dynamically import AdminDashboard with SSR disabled to satisfy Leaflet
const AdminDashboard = dynamic(
  () => import("@/components/AdminDashboard").then((mod) => mod.AdminDashboard),
  { ssr: false }
);

type AppShellProps = {
  userName: string;
  businessName: string;
  role: string;
  logout: () => Promise<void>;
  moneyOwed?: { outstandingCents: number; overdueCents: number; overdueCount: number; currencyCode: string };
};

export function AppShell({ userName, businessName, role, logout, moneyOwed }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<any>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentRole, setCurrentRole] = useState<any>(role);

  const jobs = INITIAL_JOBS;
  const clients = INITIAL_CLIENTS;
  const technicians = INITIAL_USERS.filter((u) => u.role === "TECHNICIAN");
  const invoices = INITIAL_INVOICES;
  const tenants = INITIAL_TENANTS;
  const activeTenant = tenants[0];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        unassignedCount={jobs.filter((j) => !j.assignedTechId).length}
        dominoConflictsCount={0}
        onNewJobClick={() => {}}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopHeader
          activeTab={activeTab}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          dominoConflictsCount={0}
          unassignedCount={jobs.filter((j) => !j.assignedTechId).length}
          onNewJobClick={() => {}}
          onNewQuoteClick={() => {}}
          onTabChange={setActiveTab}
          tenants={tenants}
          activeTenant={activeTenant}
          currentRole={currentRole}
          onSelectTenant={() => {}}
          onRoleChange={setCurrentRole}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3 text-sm text-slate-400">
            <span>{userName} · {businessName}</span>
            <Link href="/clients" className="text-amber-400 hover:underline">Clients</Link>
            <Link href="/quotes" className="text-amber-400 hover:underline">Quotes</Link>
            <Link href="/jobs" className="text-amber-400 hover:underline">Jobs</Link>
            <Link href="/invoices" className="text-amber-400 hover:underline">Invoices</Link>
            <Link href="/invoices/overdue" className="text-amber-400 hover:underline">Reminders</Link>
            <Link href="/schedule" className="text-amber-400 hover:underline">Schedule</Link>
            <Link href="/team" className="text-amber-400 hover:underline">Team</Link>
            <Link href="/settings/business" className="text-amber-400 hover:underline">Business</Link>
            <Link href="/settings/price-list" className="text-amber-400 hover:underline">Price list</Link>
            <Link href="/settings/payments" className="text-amber-400 hover:underline">Payments</Link>
            <Link href="/settings/security" className="text-amber-400 hover:underline">Security</Link>
            <form action={logout}><button className="text-slate-300 hover:text-white">Log out</button></form>
          </div>
          {moneyOwed && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between text-xs text-slate-500">Outstanding</div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-100">
                  {formatMoney(moneyOwed.outstandingCents, moneyOwed.currencyCode)}
                </div>
              </div>
              <Link
                href="/invoices/overdue"
                className="rounded-xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700"
              >
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
        </main>
      </div>
    </div>
  );
}