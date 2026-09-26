"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { TopHeader } from "@/components/TopHeader";
import {
  INITIAL_USERS,
  INITIAL_CLIENTS,
  INITIAL_JOBS,
  INITIAL_INVOICES,
} from "@/data/mockData";
import { INITIAL_TENANTS } from "@/data/tenantMockData";

// Dynamically import AdminDashboard with SSR disabled to satisfy Leaflet
const AdminDashboard = dynamic(
  () => import("@/components/AdminDashboard").then((mod) => mod.AdminDashboard),
  { ssr: false }
);

export default function Home() {
  const [activeTab, setActiveTab] = useState<any>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentRole, setCurrentRole] = useState<any>("ADMIN");

  const jobs = INITIAL_JOBS;
  const clients = INITIAL_CLIENTS;
  const technicians = INITIAL_USERS.filter((u) => u.role === "technician" || u.role === "field_worker" || true);
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
        unassignedCount={jobs.filter((j) => !j.assignedTechnicianId).length}
        dominoConflictsCount={0}
        onNewJobClick={() => {}}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopHeader
          activeTab={activeTab}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          dominoConflictsCount={0}
          unassignedCount={jobs.filter((j) => !j.assignedTechnicianId).length}
          onNewJobClick={() => {}}
          onNewQuoteClick={() => {}}
          onTabChange={setActiveTab}
          tenants={tenants}
          activeTenant={activeTenant}
          currentUserRole={currentRole}
          onRoleChange={setCurrentRole}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
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