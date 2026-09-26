import React from 'react';
import {
  Plus,
  Smartphone,
  LayoutDashboard,
  FileText,
  Users,
  Code2,
  Calendar,
  TrendingUp,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'team-calendar'
  | 'lead-capture'
  | 'webhooks'
  | 'job-costing'
  | 'quotes'
  | 'field-mobile'
  | 'invoices'
  | 'clients'
  | 'super-admin'
  | 'architecture';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onNewJobClick: () => void;
  onNewQuoteClick?: () => void;
  unassignedCount: number;
  dominoConflictsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onNewJobClick,
  onNewQuoteClick,
  unassignedCount,
  dominoConflictsCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Brand Title (Single text element wordmark) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onTabChange('dashboard')}
            className="text-left group cursor-pointer focus:outline-none"
          >
            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-amber-600 transition-colors">
              Service<span className="text-amber-600">Kasi</span>
            </span>
          </button>
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 pl-2 border-l border-slate-200">
            <span>South Africa</span>
            <span aria-hidden="true">·</span>
            <span>ZAR & 15% VAT</span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Clean text buttons with active states) */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-500" />
            <span>Dispatch Hub</span>
          </button>

          <button
            onClick={() => onTabChange('team-calendar')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'team-calendar'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Daily Schedule</span>
            {dominoConflictsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => onTabChange('job-costing')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'job-costing'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Costing & P&L</span>
          </button>

          <button
            onClick={() => onTabChange('quotes')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'quotes'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Quotes & Markup</span>
          </button>

          <button
            onClick={() => onTabChange('field-mobile')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'field-mobile'
                ? 'bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-600" />
            <span>Tech Terminal</span>
          </button>

          <button
            onClick={() => onTabChange('invoices')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'invoices'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Tax Invoices</span>
          </button>

          <button
            onClick={() => onTabChange('clients')}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'clients'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Clients</span>
          </button>

          <button
            onClick={() => onTabChange('architecture')}
            className={`hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Prisma Docs</span>
          </button>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-2">
          {dominoConflictsCount > 0 && (
            <button
              onClick={() => onTabChange('team-calendar')}
              className="hidden md:inline-flex items-center gap-1 text-[11px] text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-md font-bold animate-pulse"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{dominoConflictsCount} Domino Alert</span>
            </button>
          )}

          <button
            onClick={onNewJobClick}
            className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Dispatch</span>
          </button>
        </div>
      </div>
    </header>
  );
};
