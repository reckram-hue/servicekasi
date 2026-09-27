'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@prisma/client';
import { Sidebar } from '@/components/Sidebar';

/** The persistent left sidebar + content area shared by every signed-in page. */
export function AppChrome({
  userName,
  businessName,
  role,
  logout,
  securityReminder,
  showGettingStarted,
  showMyDay,
  children,
}: {
  userName: string;
  businessName: string;
  role: Role;
  logout: () => Promise<void>;
  securityReminder: boolean;
  showGettingStarted: boolean;
  showMyDay: boolean;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar
        userName={userName}
        businessName={businessName}
        role={role}
        logout={logout}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((c) => !c)}
        showGettingStarted={showGettingStarted}
        showMyDay={showMyDay}
      />
      <main className={`min-w-0 flex-1 overflow-y-auto transition-all duration-300 ease-in-out ${isCollapsed ? 'pl-[72px]' : 'pl-64'}`}>
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
