import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  MapPin,
  UserCheck,
  ArrowRight,
  RefreshCw,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Client, DominoConflict, Job, User } from '../types';
import {
  detectDominoConflicts,
  timeToMinutes,
  minutesToTime,
  formatZAR,
  createWhatsAppDispatchLink,
} from '../lib/southAfrica';

interface TeamCalendarViewProps {
  jobs: Job[];
  technicians: User[];
  clients: Client[];
  onAutoCascadeShift: (conflict: DominoConflict) => void;
  onReassignJob: (jobId: string, newTechId: string) => void;
  onSelectJob: (jobId: string) => void;
  onSimulateOverrun: (jobId: string, overrunMinutes: number) => void;
}

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export const TeamCalendarView: React.FC<TeamCalendarViewProps> = ({
  jobs,
  technicians,
  clients,
  onAutoCascadeShift,
  onReassignJob,
  onSelectJob,
  onSimulateOverrun,
}) => {
  const [selectedDate, setSelectedDate] = useState('2026-09-24');
  const [reassignModalJob, setReassignModalJob] = useState<Job | null>(null);

  // Detect active domino conflicts
  const conflicts = detectDominoConflicts(jobs, technicians);

  const getClient = (clientId: string) => clients.find((c) => c.id === clientId);

  // Filter jobs for selected date
  const dayJobs = jobs.filter((j) => j.scheduledDate === selectedDate && j.status !== 'CANCELLED');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Team Daily Dispatch & Domino Cascade Calendar
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {technicians.length} Active Crews
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time schedule monitoring, multi-crew lane views & intelligent cascade conflict resolution
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setSelectedDate('2026-09-24')}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-800 transition-colors"
          >
            Today (24 Sep)
          </button>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => {
                const prev = new Date(new Date(selectedDate).getTime() - 86400000)
                  .toISOString()
                  .split('T')[0];
                setSelectedDate(prev);
              }}
              className="p-1 text-slate-600 hover:text-slate-900"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-mono font-bold text-slate-900">
              {selectedDate}
            </span>
            <button
              onClick={() => {
                const next = new Date(new Date(selectedDate).getTime() + 86400000)
                  .toISOString()
                  .split('T')[0];
                setSelectedDate(next);
              }}
              className="p-1 text-slate-600 hover:text-slate-900"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* DOMINO EFFECT CASCADE ALERT BANNER */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5 space-y-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 text-red-900 font-bold text-sm">
              <div className="p-1.5 bg-red-600 text-white rounded-lg animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span>Domino Schedule Conflict Detected!</span>
                <span className="text-xs font-normal text-red-700 block">
                  On-site job overrun is causing a cascade delay for technician appointments downstream.
                </span>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold uppercase bg-red-100 text-red-800 px-2 py-1 rounded">
              {conflicts.length} Critical Conflict{conflicts.length === 1 ? '' : 's'}
            </span>
          </div>

          {conflicts.map((conflict, idx) => {
            const delayedJob = jobs.find((j) => j.id === conflict.delayedJobId);
            const affectedJobs = jobs.filter((j) => conflict.affectedJobIds.includes(j.id));
            const delayedClient = delayedJob ? getClient(delayedJob.clientId) : null;

            return (
              <div
                key={idx}
                className="bg-white rounded-lg p-4 border border-red-200 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-red-700">Root Cause: </span>
                    <span className="font-semibold text-slate-900">
                      {delayedJob?.jobNumber} ({delayedJob?.title})
                    </span>{' '}
                    assigned to <span className="font-bold text-slate-800">{conflict.technicianName}</span>{' '}
                    has overrun by{' '}
                    <span className="font-bold text-red-700 font-mono">
                      +{Math.round(conflict.overrunMinutes / 60)}h {conflict.overrunMinutes % 60}m
                    </span>.
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">
                    Site: {delayedClient?.address.suburb}
                  </span>
                </div>

                {/* Affected Downstream Appointments */}
                <div className="p-2.5 bg-red-50/60 rounded-md border border-red-100 text-xs space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-800 block">
                    Blocked Downstream Appointments:
                  </span>
                  {affectedJobs.map((affJob) => {
                    const affClient = getClient(affJob.clientId);
                    return (
                      <div
                        key={affJob.id}
                        className="flex items-center justify-between text-slate-800 bg-white p-2 rounded border border-red-100"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-red-700">
                            {affJob.jobNumber}
                          </span>
                          <span>{affJob.title}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">
                            {affClient?.name} ({affClient?.address.suburb})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-slate-500">Scheduled: {affJob.scheduledTime}</span>
                          <button
                            onClick={() => setReassignModalJob(affJob)}
                            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium"
                          >
                            Reassign Crew
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Instant Remediation Actions */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => onAutoCascadeShift(conflict)}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Auto-Cascade Push Downstream (+{Math.round(conflict.overrunMinutes / 60)}h)</span>
                  </button>

                  {affectedJobs[0] && (
                    <a
                      href={createWhatsAppDispatchLink(
                        getClient(affectedJobs[0].clientId)?.phone || '+27820000000',
                        getClient(affectedJobs[0].clientId)?.name || 'Client',
                        conflict.technicianName,
                        `rescheduled time (delayed due to emergency)`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp Delay Apology to {getClient(affectedJobs[0].clientId)?.name.split(' ')[0]}</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MULTI-TECHNICIAN DAILY SCHEDULE GRID */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            {/* Technicians Header Columns */}
            <div className="grid grid-cols-[80px_repeat(4,1fr)] border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
              <div className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 flex items-center justify-center">
                Time
              </div>
              {technicians.map((tech) => {
                const techJobs = dayJobs.filter((j) => j.assignedTechId === tech.id);
                const hasOverrun = techJobs.some((j) => (j.overrunMinutes || 0) > 0);

                return (
                  <div
                    key={tech.id}
                    className="p-3 border-r border-slate-200 last:border-r-0 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <img
                          src={tech.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80'}
                          alt={tech.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                            hasOverrun ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">
                          {tech.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {tech.specialties[0]}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-mono font-semibold text-slate-600">
                        {techJobs.length} job{techJobs.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time Slot Rows with Placed Job Cards */}
            <div className="relative">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[80px_repeat(4,1fr)] min-h-[72px] border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  {/* Time label */}
                  <div className="p-2 text-xs font-mono font-semibold text-slate-400 border-r border-slate-200 flex items-start justify-center">
                    {String(hour).padStart(2, '0')}:00
                  </div>

                  {/* 4 Lanes for 4 Technicians */}
                  {technicians.map((tech) => {
                    const techJobsAtHour = dayJobs.filter((job) => {
                      if (job.assignedTechId !== tech.id) return false;
                      const startH = parseInt(job.scheduledStartTime.split(':')[0], 10);
                      return startH === hour;
                    });

                    return (
                      <div
                        key={tech.id}
                        className="p-1.5 border-r border-slate-200 last:border-r-0 relative group"
                      >
                        {techJobsAtHour.map((job) => {
                          const client = getClient(job.clientId);
                          const isOverrun = (job.overrunMinutes || 0) > 0;
                          const hasConflict = job.hasDominoConflict;

                          return (
                            <div
                              key={job.id}
                              onClick={() => onSelectJob(job.id)}
                              className={`rounded-lg p-2.5 border transition-all cursor-pointer shadow-xs space-y-1.5 ${
                                isOverrun || hasConflict
                                  ? 'bg-red-50/90 border-red-300 ring-1 ring-red-400'
                                  : job.status === 'COMPLETED'
                                  ? 'bg-emerald-50/90 border-emerald-200'
                                  : job.status === 'IN_PROGRESS'
                                  ? 'bg-purple-50 border-purple-200'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-mono font-bold text-slate-900">
                                  {job.jobNumber}
                                </span>
                                <span
                                  className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                    isOverrun
                                      ? 'bg-red-600 text-white animate-pulse'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {isOverrun ? `Overrun +${job.overrunMinutes}m` : job.status}
                                </span>
                              </div>

                              <h5 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">
                                {job.title}
                              </h5>

                              {client && (
                                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                                  <span className="truncate">{client.name}</span>
                                  <span className="text-slate-400 truncate">
                                    {client.address.suburb}
                                  </span>
                                </div>
                              )}

                              <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                                <span>{job.scheduledTime}</span>
                                <span>{job.estimatedDurationHours}h</span>
                              </div>

                              {/* Overrun Simulator Button (to demo cascade dynamics) */}
                              <div className="pt-1 flex items-center justify-between text-[10px]">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSimulateOverrun(
                                      job.id,
                                      job.overrunMinutes ? 0 : 180 // Toggle 3h overrun
                                    );
                                  }}
                                  className="text-amber-700 hover:text-amber-900 font-semibold underline flex items-center gap-0.5"
                                >
                                  <Zap className="w-3 h-3 text-amber-500" />
                                  {job.overrunMinutes ? 'Clear Delay' : '+Simulate 3h Overrun'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* REASSIGN TECHNICIAN MODAL */}
      {reassignModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Reassign Delayed Appointment</h3>
              <p className="text-xs text-slate-500">
                Shift work order {reassignModalJob.jobNumber} to an available crew to clear domino blockage
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-800">{reassignModalJob.title}</div>
              <div className="text-slate-600">
                Scheduled Slot: {reassignModalJob.scheduledTime} ({reassignModalJob.estimatedDurationHours}h)
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Select Available Technician:
              </label>
              {technicians.map((t) => {
                const isCurrent = t.id === reassignModalJob.assignedTechId;
                return (
                  <button
                    key={t.id}
                    disabled={isCurrent}
                    onClick={() => {
                      onReassignJob(reassignModalJob.id, t.id);
                      setReassignModalJob(null);
                    }}
                    className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition-colors ${
                      isCurrent
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{t.name}</div>
                      <div className="text-[11px] text-slate-500">{t.specialties[0]}</div>
                    </div>
                    {isCurrent ? (
                      <span className="text-[10px] text-slate-400">Current (Blocked)</span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600">Assign Crew →</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setReassignModalJob(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
