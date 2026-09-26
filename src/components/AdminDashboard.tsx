import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  UserCheck,
  FileText,
  Search,
  ExternalLink,
  ChevronRight,
  Filter,
  Map as MapIcon,
  Route as RouteIcon,
  Trophy,
} from 'lucide-react';
import { Client, Invoice, Job, JobStatus, User } from '../types';
import {
  formatZAR,
  createWhatsAppDispatchLink,
  createGoogleMapsLink,
} from '../lib/southAfrica';
import { AdminRouteMap } from './AdminRouteMap';
import { TopTechnicianLeaderboard } from './TopTechnicianLeaderboard';

interface AdminDashboardProps {
  jobs: Job[];
  clients: Client[];
  technicians: User[];
  invoices: Invoice[];
  onUpdateJobStatus: (jobId: string, status: JobStatus) => void;
  onAssignTechnician: (jobId: string, techId: string) => void;
  onSelectJobForTechView: (jobId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onCreateInvoiceForJob: (job: Job) => void;
  onOpenNewJobModal: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  jobs,
  clients,
  technicians,
  invoices,
  onUpdateJobStatus,
  onAssignTechnician,
  onSelectJobForTechView,
  onSelectInvoice,
  onCreateInvoiceForJob,
  onOpenNewJobModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'BOARD' | 'MAP' | 'LIST'>('BOARD');
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  // Compute key South African financial metrics
  const totalRevenueInclVat = invoices
    .filter((inv) => inv.status === 'PAID')
    .reduce((sum, inv) => sum + inv.totalInclVat, 0);

  const pendingRevenueInclVat = invoices
    .filter((inv) => inv.status === 'SENT' || inv.status === 'DRAFT')
    .reduce((sum, inv) => sum + inv.totalInclVat, 0);

  const totalVatCollected = invoices
    .filter((inv) => inv.status === 'PAID')
    .reduce((sum, inv) => sum + inv.vatTotal, 0);

  const activeJobsCount = jobs.filter(
    (j) => j.status === 'IN_PROGRESS' || j.status === 'SCHEDULED'
  ).length;
  const unassignedJobs = jobs.filter((j) => !j.assignedTechId && j.status !== 'CANCELLED');
  const completedJobsCount = jobs.filter(
    (j) => j.status === 'COMPLETED' || j.status === 'INVOICED'
  ).length;

  const filteredJobs = jobs.filter((job) => {
    const client = clients.find((c) => c.id === job.clientId);
    const tech = technicians.find((t) => t.id === job.assignedTechId);
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.jobNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client?.name.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (client?.address.suburb.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (tech?.name.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getClient = (clientId: string) => clients.find((c) => c.id === clientId);
  const getTech = (techId?: string) => technicians.find((t) => t.id === techId);

  const statusColumns: { key: JobStatus; label: string; dotColor: string }[] = [
    { key: 'PENDING', label: 'Unscheduled / Queue', dotColor: 'bg-amber-400' },
    { key: 'SCHEDULED', label: 'Dispatched & Scheduled', dotColor: 'bg-blue-500' },
    { key: 'IN_PROGRESS', label: 'Tech On Site / In Progress', dotColor: 'bg-purple-500' },
    { key: 'COMPLETED', label: 'Work Complete (Ready to Bill)', dotColor: 'bg-emerald-500' },
    { key: 'INVOICED', label: 'Invoiced & Settled', dotColor: 'bg-slate-700' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Field Operations & Dispatch Hub
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time technician tracking, South African Rand revenue & SARS VAT operations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setViewMode('BOARD')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'BOARD'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dispatch Board
            </button>
            <button
              onClick={() => setViewMode('MAP')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'MAP'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RouteIcon className="w-3.5 h-3.5 text-amber-600" />
              <span>Route Map</span>
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'LIST'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Table View
            </button>
          </div>

          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
              showLeaderboard
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            <span>{showLeaderboard ? 'Hide Leaderboard' : 'Show Top Technicians'}</span>
          </button>

          <button
            onClick={onOpenNewJobModal}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs"
          >
            + Dispatch Job
          </button>
        </div>
      </div>

      {/* Financial & Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Collected Revenue (ZAR)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatZAR(totalRevenueInclVat)}
          </p>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <span>Incl. 15% VAT</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-700 font-medium">
              VAT: {formatZAR(totalVatCollected)}
            </span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending Invoices (ZAR)</span>
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatZAR(pendingRevenueInclVat)}
          </p>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <span>Sent & Draft Invoices</span>
            <span aria-hidden="true">·</span>
            <span>Awaiting PayFast / EFT</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Dispatches</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {activeJobsCount}
          </p>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <span>Scheduled & On Site</span>
            <span aria-hidden="true">·</span>
            <span>{technicians.length} field techs</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Unassigned Queue</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {unassignedJobs.length}
          </p>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <span>Awaiting technician allocation</span>
          </div>
        </div>
      </div>

      {/* Gamified Top Technician Leaderboard Widget */}
      {showLeaderboard && (
        <TopTechnicianLeaderboard
          jobs={jobs}
          technicians={technicians}
          onSelectTechnician={onSelectJobForTechView}
        />
      )}

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by job #, suburb, client, technician..."
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="flex items-center gap-1">
            {['ALL', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {status === 'ALL'
                  ? 'All Jobs'
                  : status === 'IN_PROGRESS'
                  ? 'In Progress'
                  : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DISPATCH BOARD VIEW */}
      {viewMode === 'BOARD' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {statusColumns.map((col) => {
            const columnJobs = filteredJobs.filter((j) => j.status === col.key);
            return (
              <div
                key={col.key}
                className="bg-slate-50/75 rounded-xl border border-slate-200/80 p-3 flex flex-col min-h-[500px]"
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-bold text-slate-800 tracking-tight">
                      {col.label}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-400">
                    {columnJobs.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {columnJobs.map((job) => {
                    const client = getClient(job.clientId);
                    const tech = getTech(job.assignedTechId);
                    const invoice = invoices.find((inv) => inv.id === job.invoiceId);

                    return (
                      <div
                        key={job.id}
                        className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs hover:border-slate-300 transition-all space-y-2.5"
                      >
                        {/* Job Reference & Priority */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-slate-900">
                            {job.jobNumber}
                          </span>
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider ${
                              job.priority === 'URGENT'
                                ? 'text-red-600'
                                : job.priority === 'HIGH'
                                ? 'text-amber-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {job.priority}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">
                          {job.title}
                        </h4>

                        {/* South African Location & Client */}
                        {client && (
                          <div className="text-xs text-slate-500 space-y-1">
                            <p className="font-medium text-slate-700 truncate">{client.name}</p>
                            <div className="flex items-center gap-1 truncate text-[11px]">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {client.address.suburb}, {client.address.city}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Schedule Date & Time */}
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-100">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{job.scheduledDate}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{job.scheduledTime}</span>
                        </div>

                        {/* Technician Assignment */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <select
                            value={job.assignedTechId || ''}
                            onChange={(e) => onAssignTechnician(job.id, e.target.value)}
                            className="text-[11px] font-medium py-1 px-2 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          >
                            <option value="">Unassigned</option>
                            {technicians.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name.split(' ')[0]}
                              </option>
                            ))}
                          </select>

                          {/* Fast Action Buttons */}
                          <div className="flex items-center gap-1">
                            {client && tech && (
                              <a
                                href={createWhatsAppDispatchLink(
                                  client.phone,
                                  client.name,
                                  tech.name,
                                  job.scheduledTime
                                )}
                                target="_blank"
                                rel="noreferrer"
                                title="WhatsApp Dispatch Alert"
                                className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => onSelectJobForTechView(job.id)}
                              title="Open in Mobile Tech view"
                              className="p-1 rounded text-amber-700 hover:bg-amber-50"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Status Quick Stepper */}
                        <div className="pt-1 flex items-center justify-between">
                          <select
                            value={job.status}
                            onChange={(e) =>
                              onUpdateJobStatus(job.id, e.target.value as JobStatus)
                            }
                            className="text-[10px] uppercase font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
                          >
                            <option value="PENDING">Pending</option>
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="INVOICED">Invoiced</option>
                          </select>

                          {job.status === 'COMPLETED' && !job.invoiceId && (
                            <button
                              onClick={() => onCreateInvoiceForJob(job)}
                              className="text-[10px] text-amber-700 font-semibold hover:underline flex items-center gap-0.5"
                            >
                              <FileText className="w-3 h-3" />
                              Bill Now
                            </button>
                          )}

                          {job.invoiceId && invoice && (
                            <button
                              onClick={() => onSelectInvoice(invoice.id)}
                              className="text-[10px] text-emerald-700 font-semibold hover:underline flex items-center gap-0.5"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {invoice.status}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {columnJobs.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                      <span>No jobs in this queue</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'MAP' ? (
        /* CENTRAL ROUTE PLANNING MAP VIEW */
        <AdminRouteMap
          jobs={filteredJobs}
          clients={clients}
          technicians={technicians}
          onSelectJobForTechView={onSelectJobForTechView}
          onAssignTechnician={onAssignTechnician}
          onUpdateJobStatus={onUpdateJobStatus}
        />
      ) : (
        /* TABLE LIST VIEW */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3">Work Order</th>
                  <th className="px-4 py-3">Client & Location</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Schedule Slot</th>
                  <th className="px-4 py-3">Technician</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => {
                  const client = getClient(job.clientId);
                  const tech = getTech(job.assignedTechId);
                  return (
                    <tr key={job.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className="font-mono">{job.jobNumber}</div>
                        <div className="text-slate-600 line-clamp-1 max-w-xs">{job.title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{client?.name}</div>
                        <div className="text-slate-400 text-[11px]">
                          {client?.address.suburb}, {client?.address.city}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{job.category}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{job.scheduledDate}</div>
                        <div className="font-mono text-slate-400 text-[11px]">
                          {job.scheduledTime}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={job.assignedTechId || ''}
                          onChange={(e) => onAssignTechnician(job.id, e.target.value)}
                          className="text-xs px-2 py-1 border border-slate-200 rounded bg-white"
                        >
                          <option value="">Unassigned</option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[11px] text-slate-700">
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onSelectJobForTechView(job.id)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                          >
                            Open Field App
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
