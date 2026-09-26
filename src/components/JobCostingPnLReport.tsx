import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  DollarSign,
  Filter,
  CheckCircle2,
  HelpCircle,
  Download,
  Search,
  ExternalLink,
} from 'lucide-react';
import { Client, Job, User } from '../types';
import { formatZAR } from '../lib/southAfrica';

interface JobCostingPnLReportProps {
  jobs: Job[];
  clients: Client[];
  technicians: User[];
  onSelectJob: (jobId: string) => void;
}

export const JobCostingPnLReport: React.FC<JobCostingPnLReportProps> = ({
  jobs,
  clients,
  technicians,
  onSelectJob,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const getClient = (clientId: string) => clients.find((c) => c.id === clientId);
  const getTech = (techId?: string) => technicians.find((t) => t.id === techId);

  // Compute aggregate company financial performance across all work orders
  const totalRevenue = jobs.reduce((sum, j) => sum + (j.costing?.actualRevenueExclVat || 0), 0);
  const totalActualCost = jobs.reduce((sum, j) => sum + (j.costing?.actualTotalCostZAR || 0), 0);
  const totalEstimatedCost = jobs.reduce((sum, j) => sum + (j.costing?.estimatedTotalCostZAR || 0), 0);
  const totalGrossProfit = totalRevenue - totalActualCost;
  const overallMarginPercent = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

  const totalLaborHoursVariance = jobs.reduce(
    (sum, j) => sum + (j.costing?.laborHoursVariance || 0),
    0
  );

  const filteredJobs = jobs.filter((job) => {
    const client = getClient(job.clientId);
    const tech = getTech(job.assignedTechId);
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.jobNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client?.name.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (tech?.name.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'ALL' || job.costing?.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Real-World Job Costing & P&L Variance Report
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track Estimated vs. Actual technician labor burden, material variance, and gross profit erosion per work order
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>Export P&L Report</span>
        </button>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500">Gross Billed Revenue (Excl. VAT)</span>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatZAR(totalRevenue)}
          </p>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <span>Across {jobs.length} Work Orders</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500">Total Actual Job Costs</span>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatZAR(totalActualCost)}
          </p>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span>Budget Plan: {formatZAR(totalEstimatedCost)}</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500">Realized Gross Profit (ZAR)</span>
          <p
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              totalGrossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {formatZAR(totalGrossProfit)}
          </p>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700 font-mono">
              {overallMarginPercent.toFixed(1)}% Gross Margin
            </span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500">Fleet Labor Hours Variance</span>
          <p
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              totalLaborHoursVariance > 0 ? 'text-red-600' : 'text-emerald-600'
            }`}
          >
            {totalLaborHoursVariance > 0 ? `+${totalLaborHoursVariance} hrs` : `${totalLaborHoursVariance} hrs`}
          </p>
          <div className="mt-2 text-xs text-slate-500">
            <span>Net overtime on-site vs quotes</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by job #, client, technician, or suburb..."
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
          {[
            { key: 'ALL', label: 'All Jobs' },
            { key: 'OPTIMAL', label: 'Optimal Margin' },
            { key: 'ACCEPTABLE', label: 'Acceptable' },
            { key: 'EROSION_WARNING', label: 'Erosion Warning' },
            { key: 'LOSS_ALERT', label: 'Incurred Loss' },
          ].map((status) => (
            <button
              key={status.key}
              onClick={() => setFilterStatus(status.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterStatus === status.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Job Costing & P&L Variance Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3">Work Order & Client</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3 text-right">Labor Hours (Est → Act)</th>
                <th className="px-4 py-3 text-right">Labor Cost (ZAR)</th>
                <th className="px-4 py-3 text-right">Materials Cost</th>
                <th className="px-4 py-3 text-right">Revenue (Excl. VAT)</th>
                <th className="px-4 py-3 text-right">Gross Profit (ZAR)</th>
                <th className="px-4 py-3 text-right">Margin %</th>
                <th className="px-4 py-3 text-center">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.map((job) => {
                const client = getClient(job.clientId);
                const tech = getTech(job.assignedTechId);
                const c = job.costing;
                const isExpanded = expandedJobId === job.id;

                const isLoss = (c?.actualProfitZAR || 0) < 0;
                const hasErosion = c?.status === 'EROSION_WARNING';

                return (
                  <React.Fragment key={job.id}>
                    <tr
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                      className={`hover:bg-slate-50/75 transition-colors cursor-pointer ${
                        isLoss ? 'bg-red-50/40' : hasErosion ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className="font-mono font-bold flex items-center gap-1.5">
                          <span>{job.jobNumber}</span>
                          {job.overrunMinutes && job.overrunMinutes > 0 ? (
                            <span className="text-[10px] text-red-600 font-normal">
                              (+{Math.round(job.overrunMinutes / 60)}h delay)
                            </span>
                          ) : null}
                        </div>
                        <div className="text-slate-600 line-clamp-1 max-w-xs">{job.title}</div>
                        <div className="text-slate-400 text-[11px]">
                          {client?.name} · {client?.address.suburb}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{tech?.name || 'Unassigned'}</div>
                        <div className="text-slate-400 text-[11px]">
                          Rate: R{tech?.hourlyCostRateZAR}/h wage burden
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        <div className="text-slate-900 font-semibold">
                          {c?.estimatedLaborHours}h →{' '}
                          <span
                            className={
                              (c?.laborHoursVariance || 0) > 0 ? 'text-red-600 font-bold' : 'text-slate-900'
                            }
                          >
                            {c?.actualLaborHours}h
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {(c?.laborHoursVariance || 0) > 0
                            ? `+${c?.laborHoursVariance}h Overtime`
                            : 'On Schedule'}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        <div className="text-slate-900">
                          {formatZAR(c?.actualLaborCostZAR || 0)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Est: {formatZAR(c?.estimatedLaborCostZAR || 0)}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        <div className="text-slate-900">
                          {formatZAR(c?.actualMaterialCostZAR || 0)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Est: {formatZAR(c?.estimatedMaterialCostZAR || 0)}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatZAR(c?.actualRevenueExclVat || 0)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold">
                        <span className={isLoss ? 'text-red-600' : 'text-emerald-600'}>
                          {formatZAR(c?.actualProfitZAR || 0)}
                        </span>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {c?.profitVarianceZAR && c.profitVarianceZAR < 0
                            ? `-${formatZAR(Math.abs(c.profitVarianceZAR))} vs quote`
                            : `+${formatZAR(c?.profitVarianceZAR || 0)}`}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono tabular-nums font-bold">
                        <span
                          className={
                            isLoss
                              ? 'text-red-600'
                              : (c?.actualMarginPercent || 0) < 25
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }
                        >
                          {c?.actualMarginPercent.toFixed(1)}%
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase ${
                            c?.status === 'LOSS_ALERT'
                              ? 'bg-red-600 text-white animate-pulse'
                              : c?.status === 'EROSION_WARNING'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : c?.status === 'ACCEPTABLE'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {c?.status === 'LOSS_ALERT'
                            ? 'DIRECT LOSS'
                            : c?.status === 'EROSION_WARNING'
                            ? 'MARGIN EROSION'
                            : c?.status}
                        </span>
                      </td>
                    </tr>

                    {/* Detailed Expandable Inspection Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80 border-b border-slate-200">
                        <td colSpan={9} className="p-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                              <span className="font-bold text-slate-800 block">
                                Labor Time & Overrun Root Cause
                              </span>
                              <p className="text-slate-600 leading-relaxed">
                                {job.notes || 'Routine field operation scope.'}
                              </p>
                              {job.technicianNotes && (
                                <p className="text-slate-800 font-medium pt-1 border-t border-slate-100">
                                  <span className="font-bold">Tech Field Log: </span>
                                  {job.technicianNotes}
                                </p>
                              )}
                            </div>

                            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                              <span className="font-bold text-slate-800 block">
                                Real-World Cost Breakdown (ZAR)
                              </span>
                              <div className="space-y-0.5 text-slate-600 font-mono">
                                <div className="flex justify-between">
                                  <span>Technician Wages:</span>
                                  <span>{formatZAR(c?.actualLaborCostZAR || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Supplier Materials:</span>
                                  <span>{formatZAR(c?.actualMaterialCostZAR || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Vehicle & Callout:</span>
                                  <span>{formatZAR(c?.actualCalloutZAR || 0)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-0.5">
                                  <span>Total Burden Cost:</span>
                                  <span>{formatZAR(c?.actualTotalCostZAR || 0)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2 flex flex-col justify-between">
                              <div>
                                <span className="font-bold text-slate-800 block">
                                  Financial Outcome
                                </span>
                                <p className="text-[11px] text-slate-600">
                                  {isLoss
                                    ? 'Unforeseen delays turned this contract into an operational loss. Consider issuing a revised supplementary invoice or variation order.'
                                    : 'Job is within budgeted commercial tolerances.'}
                                </p>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => onSelectJob(job.id)}
                                  className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800"
                                >
                                  Open Job Details
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
