'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import type { Role } from '@prisma/client';
import { Sidebar } from '@/components/Sidebar';

/** The persistent left sidebar + content area shared by every signed-in page. */
export function AppChrome({
  userName,
  businessName,
  role,
  logout,
  securityReminder,
  trialBanner,
  showGettingStarted,
  showMyDay,
  children,
}: {
  userName: string;
  businessName: string;
  role: Role;
  logout: () => Promise<void>;
  securityReminder: boolean;
  trialBanner: { daysLeft: number } | null;
  showGettingStarted: boolean;
  showMyDay: boolean;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setIsMobileOpen(false)} aria-hidden="true" />
      )}
      <Sidebar
        userName={userName}
        businessName={businessName}
        role={role}
        logout={logout}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((c) => !c)}
        showGettingStarted={showGettingStarted}
        showMyDay={showMyDay}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />
      <main
        className={`min-w-0 flex-1 overflow-y-auto transition-all duration-300 ease-in-out ${isCollapsed ? 'md:pl-[72px]' : 'md:pl-64'}`}
      >
        <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm font-extrabold tracking-tight text-white">
            Service<span className="text-amber-400">Kasi</span>
          </div>
        </div>
        {trialBanner && pathname !== '/settings/package' && pathname !== '/trial-ended' && (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 border-b px-6 py-2 text-sm ${
              trialBanner.daysLeft <= 3 ? 'border-amber-900 bg-amber-500/10 text-amber-200' : 'border-slate-800 bg-slate-800/50 text-slate-300'
            }`}
          >
            <span>
              {trialBanner.daysLeft === 0
                ? 'Your free trial ends today.'
                : `${trialBanner.daysLeft} day${trialBanner.daysLeft === 1 ? '' : 's'} left of your free trial.`}
            </span>
            <Link href="/settings/package" className="font-semibold hover:underline">
              Choose a package →
            </Link>
          </div>
        )}
        {securityReminder && pathname !== '/settings/security' && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-900 bg-amber-500/10 px-6 py-2 text-sm text-amber-200">
            <span>Your account isn&apos;t protected by an authenticator app yet.</span>
            <Link href="/settings/security" className="font-semibold text-amber-300 hover:underline">
              Set it up (2 minutes) →
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
