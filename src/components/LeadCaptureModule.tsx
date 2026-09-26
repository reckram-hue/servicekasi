import React, { useState } from 'react';
import {
  Globe,
  Share2,
  Copy,
  Check,
  MapPin,
  Clock,
  Calendar,
  AlertTriangle,
  Send,
  Sparkles,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Star,
  ExternalLink,
  MessageSquare,
  Zap,
  CheckCircle2,
  FileText,
  QrCode,
  Smartphone,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { Tenant, LeadSubmission } from '../types/multiTenant';
import { Job, Client, SouthAfricanProvince, SouthAfricanAddress } from '../types';
import { formatZAR, createWhatsAppDispatchLink } from '../lib/southAfrica';
import { playNotificationChime } from '../lib/notificationSound';

interface LeadCaptureModuleProps {
  tenant: Tenant;
  leads: LeadSubmission[];
  onNewLeadSubmitted: (lead: LeadSubmission) => void;
  onConvertLeadToJob: (lead: LeadSubmission) => void;
  onDismissLead: (leadId: string) => void;
  onOpenWhatsApp: (phone: string, message: string) => void;
}

const SA_PROVINCES: SouthAfricanProvince[] = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Free State',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
];

export const LeadCaptureModule: React.FC<LeadCaptureModuleProps> = ({
  tenant,
  leads,
  onNewLeadSubmitted,
  onConvertLeadToJob,
  onDismissLead,
  onOpenWhatsApp,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'PUBLIC_FORM' | 'LEADS_INBOX' | 'GBP_SETTINGS'>('PUBLIC_FORM');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [lastSubmittedId, setLastSubmittedId] = useState<string | null>(null);

  // Form State
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [serviceCategory, setServiceCategory] = useState(tenant.serviceCategories[0] || 'General Repair');
  const [urgency, setUrgency] = useState<'EMERGENCY' | 'WITHIN_24_HOURS' | 'FLEXIBLE_WEEK'>('WITHIN_24_HOURS');
  const [streetAddress, setStreetAddress] = useState('');
  const [unitOrComplex, setUnitOrComplex] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState(tenant.address.city || 'Johannesburg');
  const [province, setProvince] = useState<SouthAfricanProvince>(tenant.address.province || 'Gauteng');
  const [postalCode, setPostalCode] = useState(tenant.address.postalCode || '2000');
  const [gateCodeNotes, setGateCodeNotes] = useState('');
  const [preferredDate, setPreferredDate] = useState('2026-09-25');
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<'MORNING' | 'AFTERNOON' | 'ANYTIME'>('MORNING');
  const [issueDescription, setIssueDescription] = useState('');

  const publicUrl = `https://servicekasi.co.za/book/${tenant.slug}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleFillSample = (type: 'solar' | 'plumbing' | 'gate') => {
    if (type === 'solar') {
      setClientName('Themba Mazibuko');
      setClientPhone('+27 82 555 4910');
      setClientEmail('themba.m@vodamail.co.za');
      setServiceCategory('Solar & Inverters');
      setUrgency('EMERGENCY');
      setUnitOrComplex('Unit 34, Kyalami Glen Estate');
      setStreetAddress('12 Whispering Pines');
      setSuburb('Kyalami');
      setCity('Johannesburg');
      setProvince('Gauteng');
      setPostalCode('1684');
      setGateCodeNotes('Security boom code 5531#. Resident pre-authorized with security.');
      setPreferredDate('2026-09-25');
      setPreferredTimeSlot('MORNING');
      setIssueDescription(
        'Sunsynk 8.8kW inverter giving Error F18 (AC grid fault) after municipal power surge. No power to refrigeration circuits.'
      );
    } else if (type === 'plumbing') {
      setClientName('Dr. Carel Van Zyl');
      setClientPhone('+27 83 441 9920');
      setClientEmail('carel.vanzyl@mweb.co.za');
      setServiceCategory('Commercial Geysers & Elements');
      setUrgency('EMERGENCY');
      setUnitOrComplex('Suite 102, Medical Suites');
      setStreetAddress('75 Jean Avenue');
      setSuburb('Doringkloof');
      setCity('Centurion');
      setProvince('Gauteng');
      setPostalCode('0157');
      setGateCodeNotes('Visitor parking at rear entrance. Intercom 102.');
      setPreferredDate('2026-09-25');
      setPreferredTimeSlot('MORNING');
      setIssueDescription(
        'Main 250L commercial pressure boiler leaking into false ceiling. Urgent shutoff valve inspection and element replacement required.'
      );
    } else {
      setClientName('Nomsa Dlamini');
      setClientPhone('+27 72 890 1204');
      setClientEmail('nomsa.dlamini@investec.co.za');
      setServiceCategory('Centurion D5/D10 Gate Motors');
      setUrgency('WITHIN_24_HOURS');
      setUnitOrComplex('Villa 8, The Orchards');
      setStreetAddress('45 Hobart Road');
      setSuburb('Bryanston');
      setCity('Johannesburg');
      setProvince('Gauteng');
      setPostalCode('2191');
      setGateCodeNotes('Gate dial-in system code *88#. Dogs are secured in backyard.');
      setPreferredDate('2026-09-26');
      setPreferredTimeSlot('AFTERNOON');
      setIssueDescription(
        'Centurion D5 Evo gate motor sluggish and stops halfway along the steel rack. Battery backup error light blinking red.'
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientPhone || !streetAddress || !suburb) {
      alert('Please fill in client name, phone number, and physical street address.');
      return;
    }

    const newLead: LeadSubmission = {
      id: `lead-${Date.now()}`,
      tenantId: tenant.id,
      clientName,
      clientPhone,
      clientEmail: clientEmail || `${clientName.toLowerCase().replace(/\s+/g, '.')}@client.co.za`,
      serviceCategory,
      urgency,
      address: {
        unitOrComplex,
        streetAddress,
        suburb,
        city,
        province,
        postalCode,
        accessNotes: gateCodeNotes,
        latitude: -26.05 + (Math.random() - 0.5) * 0.15,
        longitude: 28.02 + (Math.random() - 0.5) * 0.15,
      },
      complexOrEstate: unitOrComplex,
      gateCodeNotes,
      preferredDate,
      preferredTimeSlot,
      issueDescription: issueDescription || `Urgent ${serviceCategory} service request via Google Business Profile.`,
      submittedAt: new Date().toISOString(),
      source: 'GOOGLE_BUSINESS_PROFILE',
      status: 'NEW',
    };

    // Play synthesized notification chime
    playNotificationChime('lead');

    // Trigger parent lead intake -> automatically converts to Pending Job & adds notification
    onNewLeadSubmitted(newLead);

    setLastSubmittedId(newLead.id);
    setShowSuccessBanner(true);

    // Reset Form
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setStreetAddress('');
    setUnitOrComplex('');
    setSuburb('');
    setGateCodeNotes('');
    setIssueDescription('');

    // Switch to Inbox to see the new lead
    setTimeout(() => {
      setActiveSubTab('LEADS_INBOX');
      setShowSuccessBanner(false);
    }, 2800);
  };

  const tenantLeads = leads.filter((l) => l.tenantId === tenant.id);
  const pendingLeads = tenantLeads.filter((l) => l.status === 'NEW');

  return (
    <div className="space-y-6">
      {/* Top Banner: Google Business Profile Integration Overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
            style={{ backgroundColor: tenant.branding.primaryColor }}
          >
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Google Business Profile Lead Ingestion Engine
              </h2>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Verified Integration Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Turn Google Search & Google Maps discovery into instant, structured South African field work orders.
              Every submission converts straight into a <strong>Pending Unscheduled Job</strong> with automated dispatch alerts.
            </p>
          </div>
        </div>

        {/* Public Booking URL Bar & 1-Click Copy */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Google Maps Appointment Link:
            </span>
            <span className="text-xs font-mono font-bold text-slate-800 break-all select-all">
              {publicUrl}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('PUBLIC_FORM')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeSubTab === 'PUBLIC_FORM'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4 text-amber-500" />
            <span>Public Booking Landing Page (Simulator)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('LEADS_INBOX')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors relative ${
              activeSubTab === 'LEADS_INBOX'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-500" />
            <span>Incoming Leads Inbox</span>
            {pendingLeads.length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-mono font-bold rounded-full animate-pulse">
                {pendingLeads.length} new
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('GBP_SETTINGS')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeSubTab === 'GBP_SETTINGS'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Eye className="w-4 h-4 text-emerald-500" />
            <span>Google Search & Maps Preview</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PUBLIC BOOKING FORM SIMULATOR */}
      {activeSubTab === 'PUBLIC_FORM' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Container (Left 2 Columns) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            {/* Custom Tenant Header Banner */}
            <div
              className="p-6 text-white relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${tenant.branding.primaryColor}, #0f172a)`,
              }}
            >
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase">
                      Official Booking Portal
                    </span>
                    <span className="text-amber-300 flex items-center text-xs font-bold">
                      ★ {tenant.googleBusinessProfile.googleRating} ({tenant.googleBusinessProfile.reviewCount} Google Reviews)
                    </span>
                  </div>
                  <h1 className="text-xl font-extrabold tracking-tight">
                    {tenant.businessName}
                  </h1>
                  <p className="text-xs text-slate-200 mt-1 max-w-lg">
                    {tenant.branding.tagline}
                  </p>
                </div>

                <div className="hidden sm:block text-right text-xs">
                  <div className="font-mono font-bold">{tenant.contact.phone}</div>
                  <div className="text-slate-300 text-[11px]">SARS VAT Reg: {tenant.vatNumber}</div>
                </div>
              </div>

              {/* Decorative Accent */}
              <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
            </div>

            {/* Autofill test leads quick bar */}
            <div className="bg-slate-50 px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Test Lead Autofill (1-Click Simulators):</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleFillSample('solar')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-semibold text-[11px] transition-colors"
                >
                  ⚡ Solar Surge (Dainfern)
                </button>
                <button
                  type="button"
                  onClick={() => handleFillSample('plumbing')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-semibold text-[11px] transition-colors"
                >
                  💧 Burst Geyser (Centurion)
                </button>
                <button
                  type="button"
                  onClick={() => handleFillSample('gate')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-semibold text-[11px] transition-colors"
                >
                  🛡️ Gate Motor (Bryanston)
                </button>
              </div>
            </div>

            {/* Submission Success Toast Banner */}
            {showSuccessBanner && (
              <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center gap-3 text-emerald-900 text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 animate-bounce" />
                <div className="flex-1">
                  <p className="font-bold">Lead Successfully Received via Google Business Profile!</p>
                  <p className="text-emerald-700">
                    Converted automatically into a <strong>Pending Unscheduled Job</strong>. Audio chime triggered and added to your Dispatch Board queue.
                  </p>
                </div>
              </div>
            )}

            {/* Lead Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
              {/* Client Contacts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Client Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Sindi Ndlovu"
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Phone Number (SA Format) *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="e.g. +27 82 491 8820"
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="client@gmail.com"
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Service Category & Urgency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Trade Service Category *
                  </label>
                  <select
                    value={serviceCategory}
                    onChange={(e) => setServiceCategory(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium"
                  >
                    {tenant.serviceCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="Certificate of Compliance (COC)">Certificate of Compliance (COC)</option>
                    <option value="General Emergency Maintenance">General Emergency Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Urgency & SLA Level
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setUrgency('EMERGENCY')}
                      className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[11px] transition-all ${
                        urgency === 'EMERGENCY'
                          ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      🚨 Emergency
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrgency('WITHIN_24_HOURS')}
                      className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[11px] transition-all ${
                        urgency === 'WITHIN_24_HOURS'
                          ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      ⏱️ Within 24h
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrgency('FLEXIBLE_WEEK')}
                      className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[11px] transition-all ${
                        urgency === 'FLEXIBLE_WEEK'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      📅 Flexible
                    </button>
                  </div>
                </div>
              </div>

              {/* South African Physical Address (Optimized for Complex / Estate Access) */}
              <div className="space-y-3 p-4 bg-slate-50/75 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  <span>South African Physical Location & Access Security</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">
                      Complex / Security Estate / Unit (Optional)
                    </label>
                    <input
                      type="text"
                      value={unitOrComplex}
                      onChange={(e) => setUnitOrComplex(e.target.value)}
                      placeholder="e.g. Unit 18, Dainfern Golf Estate"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="e.g. 42 Broadacres Drive"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-slate-600 mb-1">Suburb *</label>
                    <input
                      type="text"
                      required
                      value={suburb}
                      onChange={(e) => setSuburb(e.target.value)}
                      placeholder="e.g. Fourways"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Johannesburg"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Province</label>
                    <select
                      value={province}
                      onChange={(e) => setProvince(e.target.value as SouthAfricanProvince)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {SA_PROVINCES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="2055"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">
                    Gate Access Instructions / Intercom Code / Access Control
                  </label>
                  <input
                    type="text"
                    value={gateCodeNotes}
                    onChange={(e) => setGateCodeNotes(e.target.value)}
                    placeholder="e.g. Dial 18# on intercom at main security boom gate. Security requires drivers license."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700"
                  />
                </div>
              </div>

              {/* Preferred Slot & Issue Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Preferred Appointment Date
                  </label>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Preferred Time Slot
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setPreferredTimeSlot('MORNING')}
                      className={`py-1.5 px-2 rounded-lg border text-center font-semibold text-[11px] ${
                        preferredTimeSlot === 'MORNING'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      Morning (08h00 - 12h00)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreferredTimeSlot('AFTERNOON')}
                      className={`py-1.5 px-2 rounded-lg border text-center font-semibold text-[11px] ${
                        preferredTimeSlot === 'AFTERNOON'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      Afternoon (12h00 - 16h00)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreferredTimeSlot('ANYTIME')}
                      className={`py-1.5 px-2 rounded-lg border text-center font-semibold text-[11px] ${
                        preferredTimeSlot === 'ANYTIME'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      First Available
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Describe the Issue or Job Requirements *
                </label>
                <textarea
                  rows={3}
                  required
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Explain symptoms, brand/model if known, breaker trips, leak locations, etc."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Verified 15% VAT Invoicing & POPIA Privacy Compliant</span>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-colors text-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Live Booking & Trigger Alert</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Google Business Profile Preview Card & QR Code */}
          <div className="space-y-4">
            {/* Google Search Mockup Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider text-[10px]">
                  Google Maps / Search Card
                </span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                  Live on Google
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">
                      {tenant.googleBusinessProfile.businessName}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {tenant.serviceCategories.slice(0, 2).join(' · ')} in {tenant.address.city}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-extrabold text-xs">
                    G
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <span className="font-bold text-slate-800 font-mono">
                    {tenant.googleBusinessProfile.googleRating}
                  </span>
                  <div className="flex text-amber-400 text-xs">★★★★★</div>
                  <span className="text-slate-400">
                    ({tenant.googleBusinessProfile.reviewCount})
                  </span>
                </div>

                <div className="text-[11px] text-slate-600">
                  📍 {tenant.address.streetAddress}, {tenant.address.suburb}
                </div>

                {/* The GBP Action Button */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                  <a
                    href={`tel:${tenant.contact.phone}`}
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-center text-[10px] flex items-center justify-center gap-1"
                  >
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>Call</span>
                  </a>

                  <button
                    onClick={handleCopyLink}
                    className="py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-center text-[10px] flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>Book Online</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-50/75 rounded-lg border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <span className="font-bold block">💡 Where does this link go?</span>
                <p className="text-amber-800 leading-snug">
                  In your Google Business Profile manager under <em>"Appointments / Bookings"</em>, paste your ServiceKasi booking slug. Customers tapping it in Google Maps land on your customized booking page!
                </p>
              </div>
            </div>

            {/* Quick QR Code Card for Field Vans / Marketing */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-slate-500" />
                  <span>Van Decal & Quote QR Code</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">PNG / SVG</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                <div className="w-16 h-16 bg-white border border-slate-300 rounded p-1 flex items-center justify-center shrink-0">
                  <QrCode className="w-12 h-12 text-slate-900" />
                </div>
                <div className="text-[11px] text-slate-600 space-y-1">
                  <p className="font-bold text-slate-900">Print on service vehicles</p>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Homeowners scan directly from your van in their driveway to book instant emergency assistance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INCOMING LEADS INBOX */}
      {activeSubTab === 'LEADS_INBOX' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
          <div className="p-4 border-b border-slate-200 bg-slate-50/75 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Google Business Profile Ingested Leads ({tenantLeads.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically converted into Pending Unscheduled Jobs ready for technician allocation
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-xs">
                {pendingLeads.length} Unscheduled
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white border-b border-slate-100 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3">Client & Contact</th>
                  <th className="px-3 py-3">Service & Urgency</th>
                  <th className="px-3 py-3">Location & Access Notes</th>
                  <th className="px-3 py-3">Preferred Slot</th>
                  <th className="px-3 py-3">Issue Description</th>
                  <th className="px-4 py-3 text-right">Dispatch Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenantLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/75 transition-colors">
                    {/* Client */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{lead.clientName}</div>
                      <div className="font-mono text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{lead.clientPhone}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {lead.source === 'GOOGLE_BUSINESS_PROFILE' ? 'Google Maps Booking' : 'Direct Slug'}
                      </div>
                    </td>

                    {/* Service & Urgency */}
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{lead.serviceCategory}</div>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          lead.urgency === 'EMERGENCY'
                            ? 'bg-rose-100 text-rose-800'
                            : lead.urgency === 'WITHIN_24_HOURS'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {lead.urgency === 'EMERGENCY'
                          ? '🚨 Emergency'
                          : lead.urgency === 'WITHIN_24_HOURS'
                          ? '⏱️ Within 24h'
                          : '📅 Flexible'}
                      </span>
                    </td>

                    {/* Address & Access */}
                    <td className="px-3 py-3 max-w-xs">
                      <div className="font-medium text-slate-800 truncate">
                        {lead.address.streetAddress}, {lead.address.suburb}
                      </div>
                      {lead.complexOrEstate && (
                        <div className="text-[11px] text-slate-500 truncate">
                          {lead.complexOrEstate}
                        </div>
                      )}
                      {lead.gateCodeNotes && (
                        <div className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded mt-1 font-mono truncate">
                          🔑 {lead.gateCodeNotes}
                        </div>
                      )}
                    </td>

                    {/* Slot */}
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-700">
                      <div>{lead.preferredDate}</div>
                      <div className="text-slate-400 text-[10px]">{lead.preferredTimeSlot}</div>
                    </td>

                    {/* Issue */}
                    <td className="px-3 py-3 max-w-xs">
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        {lead.issueDescription}
                      </p>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() =>
                            onOpenWhatsApp(
                              lead.clientPhone,
                              `Hello ${lead.clientName}, thank you for contacting ${tenant.businessName} via Google! We have logged your request for ${lead.serviceCategory} at ${lead.address.suburb}. Our dispatch team is assigning a technician.`
                            )
                          }
                          title="Send WhatsApp Acknowledgement"
                          className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onConvertLeadToJob(lead)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                        >
                          <span>Assign Tech</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {tenantLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No Google Business Profile leads recorded yet. Try submitting a test lead in the simulator tab!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GOOGLE SEARCH & MAPS PREVIEW SETTINGS */}
      {activeSubTab === 'GBP_SETTINGS' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-900">
              Google Business Profile API Configuration & Slug Mapping
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your connected Google Place ID, appointment webhook, and public landing slug for {tenant.businessName}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Connected Google Place ID</label>
              <input
                type="text"
                readOnly
                value={tenant.googleBusinessProfile.placeId}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-600"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Public Booking Slug Identifier</label>
              <input
                type="text"
                readOnly
                value={tenant.slug}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-600"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Google Rating & Social Proof</label>
              <div className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex text-amber-400">★★★★★</div>
                <span className="font-bold text-slate-900 font-mono">
                  {tenant.googleBusinessProfile.googleRating} / 5.0
                </span>
                <span className="text-slate-400">
                  ({tenant.googleBusinessProfile.reviewCount} customer reviews)
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Auto WhatsApp Acknowledgement</label>
              <div className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50 text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Instant South African WhatsApp confirmation enabled (+27 gateway)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
