import React, { useState } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Globe,
  Plus,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  MapPin,
  Calendar,
} from 'lucide-react';
import { Tenant } from '../types/multiTenant';
import { Job, Invoice } from '../types';
import { formatZAR } from '../lib/southAfrica';

interface SuperAdminViewProps {
  tenants: Tenant[];
  currentTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  jobs: Job[];
  invoices: Invoice[];
  onAddNewTenant: (newTenant: Tenant) => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  tenants,
  currentTenantId,
  onSelectTenant,
  jobs,
  invoices,
  onAddNewTenant,
}) => {
  const [isNewTenantModalOpen, setIsNewTenantModalOpen] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [tradeCategory, setTradeCategory] = useState('Solar & Inverters');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('Johannesburg');
  const [vatNumber, setVatNumber] = useState('');

  const totalMRR = tenants.reduce((sum, t) => sum + t.monthlySubscriptionZAR, 0);
  const totalFleetStaff = tenants.reduce((sum, t) => sum + t.staffUserIds.length, 0);

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !suburb) return;

    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
    const newTenant: Tenant = {
      id: `tenant-${Date.now()}`,
      slug,
      businessName,
      tradingName: businessName.split(' ')[0],
      companyRegistrationNumber: `2026/${Math.floor(100000 + Math.random() * 900000)}/07`,
      vatNumber: vatNumber || `4${Math.floor(100000000 + Math.random() * 900000000)}`,
      currency: 'ZAR',
      currencySymbol: 'R',
      contact: {
        phone: '+27 11 900 0000',
        email: `info@${slug}.co.za`,
        whatsappNumber: '+27 82 000 0000',
        supportEmail: `support@${slug}.co.za`,
      },
      address: {
        streetAddress: '1 Commercial Road',
        suburb,
        city,
        postalCode: '2000',
        province: 'Gauteng',
      },
      branding: {
        logoUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb395?w=150&auto=format&fit=crop&q=80',
        primaryColor: '#0f172a',
        accentColor: '#334155',
        tagline: `Premier ${tradeCategory} field contractors`,
      },
      banking: {
        bankName: 'First National Bank',
        accountNumber: '62849102845',
        branchCode: '250655',
        accountType: 'Business',
        accountHolder: businessName,
      },
      googleBusinessProfile: {
        placeId: `ChIJ_${slug}_2026`,
        businessName,
        googleRating: 5.0,
        reviewCount: 1,
        verifiedBadge: true,
        appointmentBookingUrl: `https://servicekasi.co.za/book/${slug}`,
        publicSlug: slug,
        googleMapsCidUrl: 'https://maps.google.com',
        isActive: true,
        autoAcknowledgeWhatsApp: true,
      },
      webhooks: [],
      staffUserIds: ['user-admin-1', 'user-tech-1'],
      serviceCategories: [tradeCategory, 'Emergency Repair'],
      subscriptionPlan: 'PRO_ENTERPRISE',
      monthlySubscriptionZAR: 2490,
      createdAt: new Date().toISOString(),
    };

    onAddNewTenant(newTenant);
    setIsNewTenantModalOpen(false);
    setBusinessName('');
    setSuburb('');
    setVatNumber('');
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Top Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-extrabold text-lg shrink-0">
            <ShieldAlert className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Platform Super-Admin Workspace</h2>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-bold">
                Multi-Tenant Core
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Global control panel managing independent South African business subscribers, subscription billing, custom slugs, and platform-wide lead ingestion.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsNewTenantModalOpen(true)}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New Business Tenant</span>
        </button>
      </div>

      {/* Global Platform KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Monthly Recurring SaaS Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatZAR(totalMRR)}
          </p>
          <div className="mt-2 text-xs text-slate-500">
            <span>{tenants.length} active business subscribers</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Business Tenants</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {tenants.length} Companies
          </p>
          <div className="mt-2 text-xs text-slate-500">
            <span>Gauteng & Western Cape hubs</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Field Vans & Technicians</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {totalFleetStaff} Fleet Techs
          </p>
          <div className="mt-2 text-xs text-slate-500">
            <span>Mobile terminals deployed</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>South African Platform Health</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600 font-mono">
            99.98%
          </p>
          <div className="mt-2 text-xs text-slate-500">
            <span>SARS 15% VAT & PayFast active</span>
          </div>
        </div>
      </div>

      {/* Tenant Subscribers Directory */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/75 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Registered Business Subscribers ({tenants.length})
          </h3>
          <span className="text-[11px] text-slate-400">
            Select a tenant to jump into their private dispatch portal
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {tenants.map((t) => {
            const isCurrent = t.id === currentTenantId;
            return (
              <div
                key={t.id}
                className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  isCurrent ? 'bg-amber-50/40 border-l-4 border-amber-500' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs"
                    style={{ backgroundColor: t.branding.primaryColor }}
                  >
                    {t.businessName[0]}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{t.businessName}</h4>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full">
                          Currently Active
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span>CIPC Reg: {t.companyRegistrationNumber}</span>
                      <span>·</span>
                      <span>SARS VAT: {t.vatNumber}</span>
                      <span>·</span>
                      <span>📍 {t.address.suburb}, {t.address.city}</span>
                    </div>

                    <div className="text-[11px] font-mono text-purple-600 mt-1 flex items-center gap-1">
                      <span>Slug: /book/{t.slug}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-emerald-700 font-semibold">
                        ★ {t.googleBusinessProfile.googleRating} Google Rating ({t.googleBusinessProfile.reviewCount})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-xs">
                    <div className="font-mono font-bold text-slate-900">
                      {formatZAR(t.monthlySubscriptionZAR)} / mo
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      {t.subscriptionPlan.replace(/_/g, ' ')}
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectTenant(t.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                      isCurrent
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {isCurrent ? 'Viewing Tenant' : 'Switch Tenant →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Provision New Tenant Modal */}
      {isNewTenantModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Provision New South African Business Tenant
              </h3>
              <button
                onClick={() => setIsNewTenantModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Registered Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Pretoria North Air Conditioning Pty Ltd"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Primary Trade Category
                  </label>
                  <select
                    value={tradeCategory}
                    onChange={(e) => setTradeCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Solar & Inverters">Solar & Inverters</option>
                    <option value="Plumbing & Geysers">Plumbing & Geysers</option>
                    <option value="HVAC & Refrigeration">HVAC & Refrigeration</option>
                    <option value="Gate Automation & Security">Gate Automation & Security</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    SARS 10-Digit VAT Number
                  </label>
                  <input
                    type="text"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    placeholder="4920198421"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Suburb *
                  </label>
                  <input
                    type="text"
                    required
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    placeholder="e.g. Montana Park"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Pretoria"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTenantModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold"
                >
                  Confirm & Provision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
