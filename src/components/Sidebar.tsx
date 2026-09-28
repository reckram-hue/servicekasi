'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  FileSpreadsheet,
  FileText,
  BellRing,
  Briefcase,
  Users,
  UserCog,
  Building2,
  ListTree,
  CreditCard,
  ShieldCheck,
  Package,
  Wallet,
  Inbox,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  LogOut,
  Rocket,
  Wrench,
  X,
  ShieldAlert,
} from 'lucide-react';
import type { Role } from '@prisma/client';

interface SidebarProps {
  userName: string;
  businessName: string;
  role: Role;
  logout: () => Promise<void>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  showGettingStarted: boolean;
  showMyDay: boolean;
  isPlatformAdmin: boolean;
  /** Phone-width off-canvas drawer state — independent of the desktop collapse/expand above. */
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  group: 'Operations' | 'Finance' | 'Management' | 'Settings' | 'Platform';
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'Operations' },
  { href: '/getting-started', label: 'Getting started', icon: Rocket, group: 'Operations' },
  { href: '/requests', label: 'Requests', icon: Inbox, group: 'Operations' },
  { href: '/my-day', label: 'My day', icon: Wrench, group: 'Operations' },
  { href: '/schedule', label: 'Schedule', icon: Calendar, group: 'Operations' },
  { href: '/jobs', label: 'Jobs', icon: Briefcase, group: 'Operations' },
  { href: '/quotes', label: 'Quotes', icon: FileSpreadsheet, group: 'Finance' },
  { href: '/invoices', label: 'Invoices', icon: FileText, group: 'Finance' },
  { href: '/invoices/overdue', label: 'Reminders', icon: BellRing, group: 'Finance' },
  { href: '/bookkeeping', label: 'Bookkeeping', icon: Wallet, group: 'Finance' },
  { href: '/clients', label: 'Clients', icon: Users, group: 'Management' },
  { href: '/messages', label: 'Messages', icon: MessageCircle, group: 'Management' },
  { href: '/team', label: 'Team', icon: UserCog, group: 'Management' },
  { href: '/settings/business', label: 'Business', icon: Building2, group: 'Settings' },
  { href: '/settings/price-list', label: 'Price list', icon: ListTree, group: 'Settings' },
  { href: '/settings/payments', label: 'Payments', icon: CreditCard, group: 'Settings' },
  { href: '/settings/security', label: 'Security', icon: ShieldCheck, group: 'Settings' },
  { href: '/settings/package', label: 'Package', icon: Package, group: 'Settings' },
  { href: '/admin/tenants', label: 'All businesses', icon: ShieldAlert, group: 'Platform' },
];

const ROLE_LABEL: Record<Role, string> = { OWNER: 'Owner', ADMIN: 'Admin', DISPATCHER: 'Office', TECHNICIAN: 'Technician' };

/** The nav item whose href is the longest match for the current path, so e.g. /invoices/overdue highlights "Reminders", not "Invoices". */
function activeHref(items: NavItem[], pathname: string): string | undefined {
  return items
    .map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export const Sidebar: React.FC<SidebarProps> = ({
  userName,
  businessName,
  role,
  logout,
  isCollapsed,
  onToggleCollapse,
  showGettingStarted,
  showMyDay,
  isPlatformAdmin,
  isMobileOpen,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const navItems = NAV_ITEMS.filter(
    (i) =>
      (i.href !== '/getting-started' || showGettingStarted) &&
      (i.href !== '/my-day' || showMyDay) &&
      (i.href !== '/settings/package' || role === 'OWNER') &&
      (i.group !== 'Platform' || isPlatformAdmin)
  );
  const active = activeHref(navItems, pathname);
  const groups: NavItem['group'][] = ['Operations', 'Finance', 'Management', 'Settings', 'Platform'];
  const initials = userName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  // The desktop collapse-to-icons state shouldn't leak into the phone-width drawer, which is
  // always full width when it's open — so it always shows full labels, never just icons.
  const showLabels = !isCollapsed || isMobileOpen;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-64 select-none flex-col border-r border-slate-800 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out md:transition-[width] md:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${isCollapsed ? 'md:w-[72px]' : 'md:w-64'}`}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        {showLabels ? (
          <Link href="/" className="group cursor-pointer text-left focus:outline-none">
            <div className="text-lg leading-tight font-extrabold tracking-tight text-white">
              Service<span className="text-amber-400">Kasi</span>
            </div>
            <div className="text-[10px] font-medium tracking-wider text-slate-400 uppercase truncate max-w-[160px]">{businessName}</div>
          </Link>
        ) : (
          <Link
            href="/"
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-sm font-extrabold text-amber-400 shadow-xs"
            title="ServiceKasi"
          >
            SK
          </Link>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`hidden rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white ${isCollapsed ? 'md:hidden' : 'md:block'}`}
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          title="Close menu"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {groups.map((group) => {
          const groupItems = navItems.filter((item) => item.group === group);
          return (
            <div key={group} className="space-y-1">
              {showLabels && <div className="mb-1.5 px-3 text-[10px] font-bold tracking-widest text-slate-500 uppercase">{group}</div>}
              {groupItems.map((item) => {
                const isActive = active === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={showLabels ? undefined : item.label}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                      isActive ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                    } ${showLabels ? '' : 'md:justify-center md:px-0'}`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-slate-200'}`} />
                    {showLabels && <span className="truncate text-left">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-800 bg-slate-950/60 p-3">
        {showLabels ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-amber-400">
                  {initials || '?'}
                </div>
                <div className="truncate">
                  <div className="truncate text-[11px] font-bold text-white">{userName}</div>
                  <div className="text-[10px] text-slate-500">{ROLE_LABEL[role]}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Collapse sidebar"
                className="hidden rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white md:block"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800/70 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <form action={logout}>
              <button
                type="submit"
                title="Log out"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
};
