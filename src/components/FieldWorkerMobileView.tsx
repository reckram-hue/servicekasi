import React, { useState } from 'react';
import {
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  Clock,
  Camera,
  PenTool,
  MessageSquare,
  ShieldAlert,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ArrowLeft,
  FileCheck,
  Check,
  Send,
} from 'lucide-react';
import { Client, DigitalSignature, Job, JobStatus, User, WorkPhoto } from '../types';
import {
  createGoogleMapsLink,
  createWhatsAppDispatchLink,
  formatZAR,
} from '../lib/southAfrica';
import { SignaturePad } from './SignaturePad';
import { PhotoUploader } from './PhotoUploader';
import { ClientLocationMap } from './ClientLocationMap';

interface FieldWorkerMobileViewProps {
  jobs: Job[];
  clients: Client[];
  technicians: User[];
  activeTechId: string;
  onSelectTech: (techId: string) => void;
  selectedJobId?: string;
  onSelectJob: (jobId: string) => void;
  onUpdateJobStatus: (jobId: string, status: JobStatus) => void;
  onAddJobPhoto: (jobId: string, photo: WorkPhoto) => void;
  onDeleteJobPhoto: (jobId: string, photoId: string) => void;
  onSaveSignature: (jobId: string, signature: DigitalSignature) => void;
  onUpdateTechNotes: (jobId: string, notes: string) => void;
  onToggleClock?: (jobId: string) => void;
  onGenerateInvoice: (job: Job) => void;
  onBackToDashboard?: () => void;
}

export const FieldWorkerMobileView: React.FC<FieldWorkerMobileViewProps> = ({
  jobs,
  clients,
  technicians,
  activeTechId,
  onSelectTech,
  selectedJobId,
  onSelectJob,
  onUpdateJobStatus,
  onAddJobPhoto,
  onDeleteJobPhoto,
  onSaveSignature,
  onUpdateTechNotes,
  onToggleClock,
  onGenerateInvoice,
  onBackToDashboard,
}) => {
  const [isPhoneFrame, setIsPhoneFrame] = useState(true);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');

  const currentTech =
    technicians.find((t) => t.id === activeTechId) || technicians[0];

  // Jobs assigned to this technician
  const assignedJobs = jobs.filter((j) => j.assignedTechId === currentTech.id);

  // Active or selected job
  const activeJob =
    jobs.find((j) => j.id === selectedJobId) ||
    assignedJobs.find((j) => j.status === 'IN_PROGRESS') ||
    assignedJobs[0];

  const client = activeJob ? clients.find((c) => c.id === activeJob.clientId) : undefined;

  const handleStatusChange = (newStatus: JobStatus) => {
    if (!activeJob) return;
    onUpdateJobStatus(activeJob.id, newStatus);
  };

  const handleNotesSave = () => {
    if (!activeJob) return;
    onUpdateTechNotes(activeJob.id, editingNotes);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Bar / Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              title="Return to Admin Hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-bold text-slate-900">
                Technician On-Site Mobile Terminal
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Offline-ready dispatch terminal for South African field conditions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Technician Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 hidden sm:inline">Active Technician:</span>
            <select
              value={currentTech.id}
              onChange={(e) => onSelectTech(e.target.value)}
              className="text-xs font-semibold py-1.5 px-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.specialties[0]})
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Device Frame Preview */}
          <button
            onClick={() => setIsPhoneFrame(!isPhoneFrame)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
          >
            {isPhoneFrame ? 'Expand Fullscreen' : 'Phone Mockup Mode'}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className={`flex justify-center ${isPhoneFrame ? 'py-4' : ''}`}>
        <div
          className={`bg-white transition-all ${
            isPhoneFrame
              ? 'w-full max-w-[420px] rounded-[40px] shadow-2xl border-[10px] border-slate-900 overflow-hidden min-h-[820px] flex flex-col relative'
              : 'w-full rounded-xl border border-slate-200 shadow-sm'
          }`}
        >
          {/* Mobile Phone Speaker & Sensor Notch (simulated) */}
          {isPhoneFrame && (
            <div className="w-full bg-slate-900 py-1 flex justify-center items-center">
              <div className="w-24 h-4 bg-slate-800 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-700 mr-2" />
                <div className="w-10 h-1 bg-slate-700 rounded-full" />
              </div>
            </div>
          )}

          {/* Mobile App Header */}
          <div className="bg-slate-900 text-white px-4 py-3 sticky top-0 z-20 flex items-center justify-between border-b border-slate-800">
            <div>
              <div className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                ServiceKasi Tech
              </div>
              <div className="text-sm font-bold truncate">{currentTech.name}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400">Assigned Today</div>
              <div className="text-xs font-mono font-bold text-white">
                {assignedJobs.length} Work Order{assignedJobs.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {/* Route Carousel / Job Selector Bar */}
          <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {assignedJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => onSelectJob(job.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  activeJob?.id === job.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    job.status === 'COMPLETED'
                      ? 'bg-emerald-400'
                      : job.status === 'IN_PROGRESS'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-blue-400'
                  }`}
                />
                <span>{job.jobNumber}</span>
                <span className="text-[10px] opacity-75">
                  ({job.address.suburb})
                </span>
              </button>
            ))}

            {assignedJobs.length === 0 && (
              <div className="text-xs text-slate-500 py-1 px-2">
                No active jobs currently assigned to {currentTech.name.split(' ')[0]}
              </div>
            )}
          </div>

          {/* Active Job Details Container */}
          {activeJob && client ? (
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              {/* Job Card Header */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-slate-900">
                    {activeJob.jobNumber}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      activeJob.priority === 'URGENT'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {activeJob.priority}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  {activeJob.title}
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {activeJob.description}
                </p>

                <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>{activeJob.scheduledTime}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    Est. {activeJob.estimatedDurationHours} hrs
                  </span>
                </div>
              </div>

              {/* South African Location & Gate Access Box */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-400 font-semibold uppercase">
                      Client & Job Site
                    </div>
                    <div className="text-sm font-bold text-slate-900">{client.name}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {client.address.streetAddress}
                      {client.address.unitOrComplex ? `, ${client.address.unitOrComplex}` : ''}
                      <br />
                      {client.address.suburb}, {client.address.city}, {client.address.province}{' '}
                      {client.address.postalCode}
                    </div>
                  </div>
                </div>

                {/* Interactive Leaflet Location Map */}
                <ClientLocationMap
                  address={client.address}
                  clientName={client.name}
                  jobNumber={activeJob.jobNumber}
                  heightClass="h-44 sm:h-48"
                />

                {/* Gate Code / Complex Access Banner */}
                {client.address.accessNotes && (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Security / Estate Access:</span>{' '}
                      {client.address.accessNotes}
                    </div>
                  </div>
                )}

                {/* 1-Tap Action Buttons (Map Navigation & WhatsApp) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={createGoogleMapsLink(client.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[44px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Open Maps</span>
                  </a>

                  <a
                    href={createWhatsAppDispatchLink(
                      client.phone,
                      client.name,
                      currentTech.name,
                      activeJob.scheduledTime
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[44px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp ETA</span>
                  </a>
                </div>
              </div>

              {/* On-Site Live Time Tracker & Real-Time Overrun Monitor */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900">
                      On-Site Labor & Time Tracker
                    </span>
                  </div>
                  {activeJob.isClockedIn ? (
                    <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-600">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Timer Active
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">Clocked Out</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans uppercase block">
                      Target Estimated
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {activeJob.estimatedDurationHours} Hours
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans uppercase block">
                      Actual Elapsed
                    </span>
                    <span
                      className={`font-bold text-sm ${
                        (activeJob.costing?.laborHoursVariance || 0) > 0
                          ? 'text-red-600'
                          : 'text-slate-900'
                      }`}
                    >
                      {activeJob.costing?.actualLaborHours || 0} Hours
                    </span>
                  </div>
                </div>

                {/* Overrun Warning if exceeded estimated time */}
                {(activeJob.overrunMinutes || 0) > 0 && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Schedule Overrun: +{Math.round(activeJob.overrunMinutes! / 60)}h delay</span>
                      <p className="text-[11px] text-red-700 mt-0.5">
                        Domino effect alert active. Dispatcher notified of collision with subsequent appointments.
                      </p>
                    </div>
                  </div>
                )}

                {/* Clock In / Out Action Button */}
                <button
                  type="button"
                  onClick={() => onToggleClock && onToggleClock(activeJob.id)}
                  className={`w-full min-h-[44px] rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 ${
                    activeJob.isClockedIn
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>
                    {activeJob.isClockedIn ? 'CLOCK OUT (PAUSE ON-SITE TIME)' : 'CLOCK IN ON-SITE'}
                  </span>
                </button>
              </div>

              {/* Work Status Progression Controls */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Job Execution Progress</span>
                  <span className="text-[11px] font-mono uppercase text-amber-700">
                    {activeJob.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleStatusChange('SCHEDULED')}
                    className={`min-h-[44px] py-2 px-1 text-xs font-medium rounded-lg text-center transition-colors ${
                      activeJob.status === 'SCHEDULED'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    En Route
                  </button>
                  <button
                    onClick={() => handleStatusChange('IN_PROGRESS')}
                    className={`min-h-[44px] py-2 px-1 text-xs font-medium rounded-lg text-center transition-colors ${
                      activeJob.status === 'IN_PROGRESS'
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    On Site
                  </button>
                  <button
                    onClick={() => handleStatusChange('COMPLETED')}
                    className={`min-h-[44px] py-2 px-1 text-xs font-medium rounded-lg text-center transition-colors ${
                      activeJob.status === 'COMPLETED'
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Completed
                  </button>
                </div>
              </div>

              {/* Site Evidence & Photo Upload Container */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200">
                <PhotoUploader
                  photos={activeJob.photos}
                  onAddPhoto={(photo) => onAddJobPhoto(activeJob.id, photo)}
                  onDeletePhoto={(photoId) => onDeleteJobPhoto(activeJob.id, photoId)}
                  jobCategory={activeJob.category}
                />
              </div>

              {/* Customer Digital Signature Component */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Customer Sign-Off & Verification
                    </span>
                  </div>
                  {activeJob.clientSignature ? (
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Signed
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-600 font-medium">Pending sign</span>
                  )}
                </div>

                {activeJob.clientSignature ? (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="h-16 bg-white rounded border border-slate-200 p-1 flex items-center justify-center">
                      <img
                        src={activeJob.clientSignature.signatureDataUrl}
                        alt="Customer Signature"
                        className="max-h-full object-contain"
                      />
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {activeJob.clientSignature.signedByName}
                      </span>
                      <span>
                        {new Date(activeJob.clientSignature.signedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowSignatureModal(true)}
                      className="w-full text-center text-[11px] text-slate-500 hover:text-slate-800 py-1"
                    >
                      Re-sign or update signature
                    </button>
                  </div>
                ) : (
                  <div>
                    {showSignatureModal ? (
                      <SignaturePad
                        defaultSignerName={client.name}
                        designation="CLIENT"
                        onSave={(sig) => {
                          onSaveSignature(activeJob.id, sig);
                          setShowSignatureModal(false);
                        }}
                        onCancel={() => setShowSignatureModal(false)}
                      />
                    ) : (
                      <button
                        onClick={() => setShowSignatureModal(true)}
                        className="w-full min-h-[44px] py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
                      >
                        <PenTool className="w-4 h-4 text-amber-400" />
                        <span>Open Customer Signature Pad</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Technician Completion Notes */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-900">
                  Technician Service Notes
                </label>
                <textarea
                  rows={2}
                  value={editingNotes || activeJob.technicianNotes || ''}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="e.g. Inverter firmware updated to v4.2, verified neutral-earth bond..."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleNotesSave}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-colors"
                  >
                    Save Notes
                  </button>
                </div>
              </div>

              {/* Generate Tax Invoice Prompt if complete */}
              {activeJob.status === 'COMPLETED' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 text-xs font-bold">
                    <FileCheck className="w-4 h-4 text-emerald-700" />
                    <span>Job Complete! Ready for Billing</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-tight">
                    Generate the South African 15% VAT Tax Invoice and send PayFast link to{' '}
                    {client.name}.
                  </p>
                  <button
                    onClick={() => onGenerateInvoice(activeJob)}
                    className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>Generate SARS Tax Invoice</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs flex-1 flex flex-col items-center justify-center">
              <Calendar className="w-8 h-8 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">No Job Selected</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Select a work order from the route carousel above to start on-site servicing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
