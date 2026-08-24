import React from 'react';
import { cn } from '../../lib/utils';
import { SidebarNav, type NavBlock } from './SidebarNav';
import { Topbar } from './Topbar';

export function AppShell({
  sidebarOpen,
  onSidebarClose,
  sidebarHeader,
  sidebarFooter,
  navBlocks,
  topbarLeft,
  topbarBrandPill,
  topbarRight,
  onSearchClick,
  onChatClick,
  unreadChatCount,
  onNotificationClick,
  notificationCount,
  children,
}: {
  sidebarOpen: boolean;
  /** Fired when the mobile backdrop is tapped so the parent can close the drawer. */
  onSidebarClose?: () => void;
  sidebarHeader: React.ReactNode;
  sidebarFooter: React.ReactNode;
  navBlocks: NavBlock[];
  topbarLeft?: React.ReactNode;
  topbarBrandPill?: React.ReactNode;
  topbarRight?: React.ReactNode;
  onSearchClick?: () => void;
  onChatClick?: () => void;
  unreadChatCount?: number;
  onNotificationClick?: () => void;
  notificationCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-50 overflow-hidden max-w-[100vw]">
      {/* Mobile-only backdrop when the drawer is open */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={onSidebarClose}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}
      <SidebarNav open={sidebarOpen} header={sidebarHeader} footer={sidebarFooter} blocks={navBlocks} />
      <main className={cn('flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden')}>
        <Topbar left={topbarLeft} brandPill={topbarBrandPill} onSearchClick={onSearchClick} onChatClick={onChatClick} unreadChatCount={unreadChatCount} onNotificationClick={onNotificationClick} notificationCount={notificationCount} right={topbarRight} />
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-8 sm:py-10 md:px-10 md:py-12 scrollbar-hide">
          <div className="max-w-[1600px] mx-auto w-full min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
