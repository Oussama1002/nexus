import type { NavigateFunction } from 'react-router-dom';
import type { NavGroup } from '../components/shell/SidebarNav';
import { pathForView } from './appPaths';
import { isSidebarNavVisible, SIDEBAR_NAV_CATALOG } from './sidebarNavCatalog';
import type { View } from '../types';
import type { User } from '../types';

export function buildSidebarNavGroups(opts: {
  activeView: View;
  navigate: NavigateFunction;
  canAccess: (v: View) => boolean;
  userRole: User['role'];
  visibility: Record<string, boolean> | null;
}): NavGroup[] {
  const { activeView, navigate, canAccess, userRole, visibility } = opts;

  const canShowItem = (key: string, view: View): boolean => {
    if (!isSidebarNavVisible(key, visibility)) return false;
    if (key === 'delivery-kpi') {
      return canAccess('delivery') || canAccess('deliveryDashboard');
    }
    return canAccess(view);
  };

  const groupsMap = new Map<string, NavGroup>();

  for (const entry of SIDEBAR_NAV_CATALOG) {
    if (!canShowItem(entry.key, entry.view)) continue;

    let group = groupsMap.get(entry.groupId);
    if (!group) {
      group = { id: entry.groupId, label: entry.groupLabel, icon: entry.groupIcon, items: [] };
      groupsMap.set(entry.groupId, group);
    }

    const label =
      entry.key === 'confirmatrice' && userRole === 'confirmatrice' && entry.confirmatriceLabel
        ? entry.confirmatriceLabel
        : entry.label;

    const path = entry.key === 'delivery-kpi'
      ? (canAccess('deliveryDashboard') ? pathForView('deliveryDashboard') : pathForView('delivery'))
      : pathForView(entry.view, entry.view === 'settings' ? 'center' : undefined);

    const isActive = entry.key === 'delivery-kpi'
      ? (activeView === 'delivery' || activeView === 'deliveryDashboard')
      : activeView === entry.view;

    group.items.push({
      id: entry.key,
      label,
      icon: entry.icon,
      active: isActive,
      path,
      onClick: () => navigate(path),
    });
  }

  let groups = Array.from(groupsMap.values()).filter((g) => g.items.length > 0);

  if (userRole === 'confirmatrice') {
    groups = groups.map((g) => {
      if (g.id !== 'ventes') return g;
      const yours = g.items.find((i) => i.id === 'confirmatrice');
      const rest = g.items.filter((i) => i.id !== 'confirmatrice');
      return { ...g, items: yours ? [yours, ...rest] : g.items };
    });
  }

  return groups;
}
