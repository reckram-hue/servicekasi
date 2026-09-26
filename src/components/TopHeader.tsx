import React from 'react';
import {
  Menu,
  AlertTriangle,
  Plus,
  ShieldCheck,
  FileSpreadsheet,
  Clock,
  Building2,
  ChevronDown,
  Globe,
  UserCheck,
  Zap,
} from 'lucide-react';
import { ActiveTab } from './Navbar';
import { Tenant, UserRole } from '../types/multiTenant';

interface TopHeaderProps {
  activeTab: ActiveTab;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  dominoConflictsCount: number;
  unassignedCount: number;
  onNewJobClick: () => void;
  onNewQuoteClick: () => void;
  onTabChange: (tab: ActiveTab) => void;
  tenants: Tenant[];
  activeTenant: Tenant;
  onSelectTenant: (tenantId: string) => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  pendingLeadsCount?: number;
}

const TAB_TITLES: Record<ActiveTab, { title: string; category: string; description: string }> = {
  dashboard: {
    category: 'Operations',
    title: 'Dispatch Hub & Board',
    description: 'Real-time technician tracking & dispatch queues',
  },
  'team-calendar': {
    category: 'Operations',
    title: 'Daily Schedule & Domino Cascade',
    description: 'Multi-crew swimlanes & automated cascade shift resolution',
  },
  'lead-capture': {
    category: 'Operations',
    title: 'Google Business Profile & Lead Ingestion',
    description: 'Public booking landing pages, SA security gate intake & live lead conversion',
  },
  'field-mobile': {
    category: 'Field Execution',
    title: 'Technician Mobile Terminal',
    description: 'GPS map navigation, on-site time tracking & customer signature',
  },
  'job-costing': {
    category: 'Finance & Governance',
    title: 'Real-World Job Costing & P&L',
    description: 'Estimated vs. actual labor burden, material variance & margin erosion',
  },
  quotes: {
    category: 'Finance & Governance',
    title: 'Quotation & Markup Engine',
    description: 'Supplier wholesale costs, customizable markup & statutory 15% VAT',
  },
  invoices: {
    category: 'Finance & Governance',
    title: 'SARS Tax Invoices & Gateways',
    description: 'CIPC reg, VAT breakdown, PayFast Instant EFT & Yoco card payments',
  },
  webhooks: {
    category: 'Finance & Governance',
    title: 'Payment Webhooks & Wallets',
    description: 'Ozow, PayFast, SnapScan & Capitec Pay real-time webhook settlement',
  },
  clients: {
    category: 'Management',
    title: 'Client Portfolio',
    description: 'Residential & commercial accounts with security gate protocols',
  },
  'super-admin': {
    category: 'Platform SaaS',
    title: 'Super-Admin Workspace',
    description: 'Multi-tenant organization management, MRR & platform audit',
  },
  architecture: {
    category: 'Architecture & DevOps',
    title: 'Prisma Schema & Next.js Blueprint',
    description: 'PostgreSQL database models & PayFast webhook integration',
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  isSidebarCollapsed,
  onToggleSidebar,
  dominoConflictsCount,
  unassignedCount,
  onNewJobClick,
  onNewQuoteClick,
  onTabChange,
  tenants,
  activeTenant,
  onSelectTenant,
  currentRole,
  onRoleChange,
  pendingLeadsCount = 0,
}) => {
  const current = TAB_TITLES[activeTab] || TAB_TITLES.dashboard;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Left: Sidebar Toggle, Tenant Selector & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Tenant Switcher Dropdown */}
          <div className="relative flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 p-1.5 rounded-xl transition-colors shrink-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-extrabold text-xs shadow-xs"
              style={{ backgroundColor: activeTenant.branding.primaryColor }}
            >
              {activeTenant.businessName[0]}
            </div>

            <select
              value={activeTenant.id}
              onChange={(e) => onSelectTenant(e.target.value)}
              aria-label="Switch Business Tenant"
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer pr-1"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tradingName} (VAT: {t.vatNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="hidden xl:block min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <span>ServiceKasi</span>
              <span aria-hidden="true" className="text-slate-300">/</span>
              <span className="text-slate-600">{current.category}</span>
              <span aria-hidden="true" className="text-slate-300">/</span>
              <span className="text-slate-900 font-semibold truncate">{current.title}</span>
            </div>
            <div className="text-xs text-slate-400 truncate">
              {current.description}
            </div>
          </div>
        </div>

        {/* Right: Role Switcher, Google Leads Alert, Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Role Switcher Pill */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 px-1.5">Role:</span>
            <select
              value={currentRole}
              onChange={(e) => {
                const newRole = e.target.value as UserRole;
                onRoleChange(newRole);
                if (newRole === 'PLATFORM_SUPER_ADMIN') {
                  onTabChange('super-admin');
                } else if (newRole === 'FIELD_TECHNICIAN') {
                  onTabChange('field-mobile');
                } else if (activeTab === 'super-admin' || activeTab === 'field-mobile') {
                  onTabChange('dashboard');
                }
              }}
              aria-label="Switch User Role"
              className="bg-white border border-slate-200 rounded-md font-bold text-xs py-1 px-2 text-slate-800 focus:outline-none"
            >
              <option value="BUSINESS_ADMIN">Business Admin</option>
              <option value="PLATFORM_SUPER_ADMIN">Platform Super-Admin</option>
              <option value="FIELD_TECHNICIAN">Field Technician</option>
            </select>
          </div>

          {/* Incoming Google Business Profile Leads Alert Pill */}
          {pendingLeadsCount > 0 && (
            <button
              onClick={() => onTabChange('lead-capture')}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 animate-pulse"
              title="New Google Business Profile Leads Received"
            >
              <Globe className="w-3.5 h-3.5 text-rose-600" />
              <span>{pendingLeadsCount} New Lead{pendingLeadsCount === 1 ? '' : 's'}</span>
            </button>
          )}

          {/* Domino Conflict Alert Pill */}
          {dominoConflictsCount > 0 && (
            <button
              onClick={() => onTabChange('team-calendar')}
              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{dominoConflictsCount} Domino Delay{dominoConflictsCount === 1 ? '' : 's'}</span>
            </button>
          )}

          {/* Quick Quote trigger */}
          <button
            onClick={onNewQuoteClick}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>+ Quote</span>
          </button>

          {/* New Work Order Primary Action */}
          <button
            onClick={onNewJobClick}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
            <span className="hidden sm:inline">New Work Order</span>
            <span className="sm:hidden">Job</span>
          </button>
        </div>
      </div>
    </header>
  );
};
