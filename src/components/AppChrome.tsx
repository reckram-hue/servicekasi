'use client';

import { useState } from 'react';
import type { Role } from '@prisma/client';
import { Sidebar } from '@/components/Sidebar';

/** The persistent left sidebar + content area shared by every signed-in page. */
export function AppChrome({
  userName,
  businessName,
  role,
  logout,
  children,
}: {
  userName: string;
  businessName: string;
  role: Role;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar
        userName={userName}
        businessName={businessName}
        role={role}
        logout={logout}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((c) => !c)}
      />
      <main className={`min-w-0 flex-1 overflow-y-auto transition-all duration-300 ease-in-out ${isCollapsed ? 'pl-[72px]' : 'pl-64'}`}>
        {children}
      </main>
    </div>
  );
}
