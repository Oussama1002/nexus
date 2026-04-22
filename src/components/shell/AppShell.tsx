import React from 'react';
import { cn } from '../../lib/utils';
import { SidebarNav, type NavGroup } from './SidebarNav';
import { Topbar } from './Topbar';

export function AppShell({
  sidebarOpen,
  sidebarHeader,
  sidebarFooter,
  navGroups,
  topbarLeft,
  topbarBrandPill,
  topbarRight,
  children,
}: {
  sidebarOpen: boolean;
  sidebarHeader: React.ReactNode;
  sidebarFooter: React.ReactNode;
  navGroups: NavGroup[];
  topbarLeft?: React.ReactNode;
  topbarBrandPill?: React.ReactNode;
  topbarRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-50 overflow-hidden">
      <SidebarNav open={sidebarOpen} header={sidebarHeader} footer={sidebarFooter} groups={navGroups} />
      <main className={cn('flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden')}>
        <Topbar left={topbarLeft} brandPill={topbarBrandPill} right={topbarRight} />
        <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-8 sm:py-10 md:px-10 md:py-12 scrollbar-hide">
          <div className="max-w-[1600px] mx-auto w-full">{children}</div>
        </div>
      </main>
    </div>
  );
}

