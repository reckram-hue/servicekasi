'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  AlertCircle,
  TrendingUp,
  FileText,
  Clock,
  Search,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { formatMoney } from '@/lib/money';
import type { DashboardJob } from '@/lib/jobs/dashboard';

interface AdminDashboardProps {
  jobs: DashboardJob[];
  technicianCount: number;
  currencyCode: string;
  finance: { collectedCents: number; collectedVatCents: number; outstandingCents: number };
  activeDispatches: number;
  unassignedCount: number;
}

const STATUS_COLUMNS: { key: DashboardJob['status']; label: string; dotColor: string }[] = [
  { key: 'DRAFT', label: 'Unscheduled / Draft', dotColor: 'bg-amber-400' },
  { key: 'SCHEDULED', label: 'Scheduled', dotColor: 'bg-blue-500' },
  { key: 'IN_PROGRESS', label: 'In Progress', dotColor: 'bg-purple-500' },
  { key: 'REQUIRES_INVOICING', label: 'Requires Invoicing', dotColor: 'bg-emerald-500' },
  { key: 'COMPLETED', label: 'Completed', dotColor: 'bg-slate-700' },
];

const PRIORITY_STYLE: Record<DashboardJob['priority'], string> = {
  EMERGENCY: 'text-red-600',
  HIGH: 'text-amber-600',
  NORMAL: 'text-slate-500',
  LOW: 'text-slate-400',
};

function visitLabel(job: DashboardJob): string {
  if (!job.nextVisit) return 'Not yet scheduled';
  const date = job.nextVisit.startsAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  const time = job.nextVisit.startsAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

function technicianLabel(job: DashboardJob): string {
  if (!job.nextVisit || job.nextVisit.technicianNames.length === 0) return 'Unassigned';
  return job.nextVisit.technicianNames.join(', ');
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  jobs,
  technicianCount,
  currencyCode,
  finance,
  activeDispatches,
  unassignedCount,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DashboardJob['status']>('ALL');
  const [viewMode, setViewMode] = useState<'BOARD' | 'LIST'>('BOARD');

  const filteredJobs = jobs.filter((job) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      job.title.toLowerCase().includes(term) ||
      job.number.toLowerCase().includes(term) ||
      job.clientName.toLowerCase().includes(term) ||
      (job.locationLabel?.toLowerCase() ?? '').includes(term) ||
      technicianLabel(job).toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Field Operations & Dispatch Hub</h1>
          <p className="mt-1 text-sm text-slate-500">Real-time job tracking and revenue at a glance</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setViewMode('BOARD')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'BOARD' ? 'bg-white font-bold text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dispatch Board
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'LIST' ? 'bg-white font-bold text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Table View
            </button>
          </div>

          <Link href="/jobs" className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-slate-800">
            + New job
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Collected Revenue</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">{formatMoney(finance.collectedCents, currencyCode)}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>Incl. VAT</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-medium tabular-nums text-slate-700">VAT: {formatMoney(finance.collectedVatCents, currencyCode)}</span>
          </div>
        </div>

        <Link href="/invoices?status=SENT" className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Outstanding Invoices</span>
            <FileText className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">{formatMoney(finance.outstandingCents, currencyCode)}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>Unpaid invoices · Awaiting payment</span>
          </div>
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Dispatches</span>
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">{activeDispatches}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>Scheduled & on site</span>
            <span aria-hidden="true">·</span>
            <span>{technicianCount} field techs</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Unassigned Queue</span>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">{unassignedCount}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>Awaiting technician allocation</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by job #, suburb, client, technician..."
            className="w-full rounded-lg border border-slate-200 py-1.5 pr-4 pl-9 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <div className="flex items-center gap-1">
            {(['ALL', ...STATUS_COLUMNS.map((c) => c.key)] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === status ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {status === 'ALL' ? 'All Jobs' : STATUS_COLUMNS.find((c) => c.key === status)!.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === 'BOARD' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {STATUS_COLUMNS.map((col) => {
            const columnJobs = filteredJobs.filter((j) => j.status === col.key);
            return (
              <div key={col.key} className="flex min-h-[400px] flex-col rounded-xl border border-slate-200/80 bg-slate-50/75 p-3">
                <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-bold tracking-tight text-slate-800">{col.label}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-400">{columnJobs.length}</span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto">
                  {columnJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="block space-y-2.5 rounded-lg border border-slate-200 bg-white p-3 shadow-2xs transition-all hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-slate-900">{job.number}</span>
                        <span className={`text-[10px] font-semibold tracking-wider uppercase ${PRIORITY_STYLE[job.priority]}`}>{job.priority}</span>
                      </div>

                      <h4 className="line-clamp-2 text-xs leading-snug font-semibold text-slate-900">{job.title}</h4>

                      <div className="space-y-1 text-xs text-slate-500">
                        <p className="truncate font-medium text-slate-700">{job.clientName}</p>
                        {job.locationLabel && (
                          <div className="flex items-center gap-1 truncate text-[11px]">
                            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                            <span className="truncate">{job.locationLabel}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{visitLabel(job)}</span>
                        </div>
                        <span className="flex items-center gap-0.5 font-medium text-amber-700">
                          Open <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">{technicianLabel(job)}</div>
                    </Link>
                  ))}

                  {columnJobs.length === 0 && (
                    <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
                      <span>No jobs in this queue</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Work Order</th>
                  <th className="px-4 py-3">Client & Location</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Next Visit</th>
                  <th className="px-4 py-3">Technician</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="transition-colors hover:bg-slate-50/75">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="font-mono">{job.number}</div>
                      <div className="line-clamp-1 max-w-xs text-slate-600">{job.title}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{job.clientName}</div>
                      <div className="text-[11px] text-slate-400">{job.locationLabel}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{job.category ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{visitLabel(job)}</td>
                    <td className="px-4 py-3 text-slate-600">{technicianLabel(job)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold text-slate-700">{job.status.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/jobs/${job.id}`} className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
