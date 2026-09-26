import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  TrendingUp,
  FileSpreadsheet,
  Smartphone,
  FileText,
  Users,
  Code2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Plus,
  ShieldCheck,
  PanelLeftClose,
  PanelLeft,
  Globe,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { ActiveTab } from './Navbar';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  unassignedCount: number;
  dominoConflictsCount: number;
  onNewJobClick: () => void;
  leadCount?: number;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  badge?: number | string;
  badgeColor?: string;
  group: 'Operations' | 'Finance & Quotes' | 'Management';
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dispatch Hub',
    shortLabel: 'Dispatch',
    icon: LayoutDashboard,
    group: 'Operations',
  },
  {
    id: 'team-calendar',
    label: 'Daily Schedule & Domino',
    shortLabel: 'Schedule',
    icon: Calendar,
    group: 'Operations',
  },
  {
    id: 'lead-capture',
    label: 'Google Leads & Booking',
    shortLabel: 'Leads',
    icon: Globe,
    group: 'Operations',
  },
  {
    id: 'field-mobile',
    label: 'Tech Mobile Terminal',
    shortLabel: 'Mobile',
    icon: Smartphone,
    group: 'Operations',
  },
  {
    id: 'job-costing',
    label: 'Job Costing & P&L',
    shortLabel: 'P&L',
    icon: TrendingUp,
    group: 'Finance & Quotes',
  },
  {
    id: 'quotes',
    label: 'Quotes & Markup',
    shortLabel: 'Quotes',
    icon: FileSpreadsheet,
    group: 'Finance & Quotes',
  },
  {
    id: 'invoices',
    label: 'SARS Tax Invoices',
    shortLabel: 'Invoices',
    icon: FileText,
    group: 'Finance & Quotes',
  },
  {
    id: 'webhooks',
    label: 'Payment Webhooks',
    shortLabel: 'Webhooks',
    icon: Zap,
    group: 'Finance & Quotes',
  },
  {
    id: 'clients',
    label: 'Clients Portfolio',
    shortLabel: 'Clients',
    icon: Users,
    group: 'Management',
  },
  {
    id: 'super-admin',
    label: 'Super-Admin Platform',
    shortLabel: 'SaaS Core',
    icon: ShieldAlert,
    group: 'Management',
  },
  {
    id: 'architecture',
    label: 'Prisma & Architecture',
    shortLabel: 'Setup',
    icon: Code2,
    group: 'Management',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  unassignedCount,
  dominoConflictsCount,
  onNewJobClick,
  leadCount = 0,
}) => {
  const groups: Array<'Operations' | 'Finance & Quotes' | 'Management'> = [
    'Operations',
    'Finance & Quotes',
    'Management',
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-300 ease-in-out select-none ${
        isCollapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <button
              onClick={() => onTabChange('dashboard')}
              className="text-left group cursor-pointer focus:outline-none"
            >
              <div className="text-lg font-extrabold tracking-tight text-white leading-tight">
                Service<span className="text-amber-400">Kasi</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                South Africa FSM
              </div>
            </button>
          </div>
        ) : (
          <button
            onClick={() => onTabChange('dashboard')}
            className="w-10 h-10 mx-auto rounded-lg bg-slate-800 text-amber-400 font-extrabold flex items-center justify-center text-sm shadow-xs"
            title="ServiceKasi"
          >
            SK
          </button>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${
            isCollapsed ? 'hidden' : 'block'
          }`}
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Button */}
      <div className="p-3 border-b border-slate-800/80">
        {!isCollapsed ? (
          <button
            type="button"
            onClick={onNewJobClick}
            className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Work Order</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onNewJobClick}
            title="New Work Order"
            className="w-10 h-10 mx-auto rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center shadow-xs transition-colors"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Navigation Links Grouped */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5 no-scrollbar">
        {groups.map((group) => {
          const groupItems = NAV_ITEMS.filter((item) => item.group === group);
          return (
            <div key={group} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  {group}
                </div>
              )}

              {groupItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                const isScheduleWithConflict =
                  item.id === 'team-calendar' && dominoConflictsCount > 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : isScheduleWithConflict
                        ? 'bg-red-950/60 text-red-300 hover:bg-red-900/60 border border-red-800/50'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <div className="relative shrink-0">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive
                            ? 'text-slate-950'
                            : isScheduleWithConflict
                            ? 'text-red-400'
                            : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      {isScheduleWithConflict && isCollapsed && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      )}
                    </div>

                    {!isCollapsed && (
                      <div className="flex-1 flex items-center justify-between truncate text-left">
                        <span className="truncate">{item.label}</span>
                        {isScheduleWithConflict && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-600 text-white font-mono animate-pulse">
                            {dominoConflictsCount} Delay
                          </span>
                        )}
                        {item.id === 'dashboard' && unassignedCount > 0 && !isScheduleWithConflict && (
                          <span className="text-[10px] font-mono text-amber-900 bg-amber-400/90 font-bold px-1.5 py-0.2 rounded">
                            {unassignedCount}
                          </span>
                        )}
                        {item.id === 'lead-capture' && (leadCount || 0) > 0 && (
                          <span className="text-[10px] font-mono text-white bg-rose-500 font-bold px-1.5 py-0.2 rounded animate-pulse">
                            {leadCount} New
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer Area with Technician / Dispatch Profile & Collapse toggle */}
      <div className="p-3 border-t border-slate-800 shrink-0 bg-slate-950/60">
        {!isCollapsed ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold text-xs">
                  AS
                </div>
                <div className="truncate">
                  <div className="font-bold text-white text-[11px] truncate">
                    Ayanda Sithole
                  </div>
                  <div className="text-[10px] text-slate-500">Dispatch Controller</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Collapse sidebar"
                className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            className="w-10 h-10 mx-auto rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};
