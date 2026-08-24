import type { NavigateFunction } from 'react-router-dom';
import type { NavBlock, NavTreeNode } from '../components/shell/SidebarNav';
import { pathForView } from './appPaths';
import { isSidebarNavVisible, NAV_BLOCKS, NAV_CATALOG } from './sidebarNavCatalog';
import type { View, User } from '../types';

export function buildSidebarNav(opts: {
  activeView: View;
  navigate: NavigateFunction;
  canAccess: (v: View) => boolean;
  userRole: User['role'];
  /** Preferred over userRole when both are present — ground truth from the API. */
  roleSlugs?: string[];
  visibility: Record<string, boolean> | null;
}): NavBlock[] {
  const { activeView, navigate, canAccess, userRole, roleSlugs, visibility } = opts;

  // Prefer the raw slug list (source of truth from the API) so we're robust
  // to any drift in the derived legacy `userRole`. A user with the
  // 'confirmatrice' role in any position gets the confirmatrice remap.
  const isConfirmatrice = roleSlugs
    ? roleSlugs.includes('confirmatrice')
    : userRole === 'confirmatrice';

  const canShowEntry = (id: string, view?: View): boolean => {
    if (!isSidebarNavVisible(id, visibility)) return false;
    if (view) return canAccess(view);
    return true;
  };

  type TreeNode = NavTreeNode & { _children: TreeNode[] };

  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  for (const entry of NAV_CATALOG) {
    const resolvedView = isConfirmatrice && entry.confirmatriceView
      ? entry.confirmatriceView
      : entry.view;

    const label = isConfirmatrice && entry.confirmatriceLabel
      ? entry.confirmatriceLabel
      : entry.label;

    const path = resolvedView
      ? pathForView(resolvedView, resolvedView === 'settings' ? 'center' : undefined)
      : undefined;

    const isActive = resolvedView ? activeView === resolvedView : false;

    const node: TreeNode = {
      id: entry.id,
      label,
      icon: entry.icon,
      view: resolvedView,
      level: entry.level,
      active: isActive,
      path,
      onClick: path ? () => navigate(path) : undefined,
      children: [],
      _children: [],
    };

    nodeMap.set(entry.id, node);

    if (entry.parentId) {
      const parent = nodeMap.get(entry.parentId);
      if (parent) {
        parent._children.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  }

  function pruneInaccessible(node: TreeNode): boolean {
    node._children = node._children.filter((child) => pruneInaccessible(child));
    node.children = node._children;

    if (node.view) {
      return canShowEntry(node.id, node.view);
    }
    return node._children.length > 0;
  }

  function markActiveAncestors(node: TreeNode): boolean {
    let hasActive = node.active;
    for (const child of node._children) {
      if (markActiveAncestors(child)) hasActive = true;
    }
    if (hasActive && !node.view) node.active = true;
    return hasActive;
  }

  const blocks: NavBlock[] = [];

  for (const blockDef of NAV_BLOCKS) {
    const l1Nodes = rootNodes
      .filter((n) => {
        const entry = NAV_CATALOG.find((e) => e.id === n.id);
        return entry?.block === blockDef.id;
      });

    const visibleSections: NavTreeNode[] = [];

    for (const l1 of l1Nodes) {
      if (!pruneInaccessible(l1)) continue;
      markActiveAncestors(l1);
      visibleSections.push(l1);
    }

    if (visibleSections.length > 0) {
      blocks.push({
        id: blockDef.id,
        label: blockDef.label,
        sections: visibleSections,
      });
    }
  }

  return blocks;
}
