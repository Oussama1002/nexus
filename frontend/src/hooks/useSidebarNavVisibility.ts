import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';
import { SIDEBAR_NAV_UPDATED_EVENT, mergeSidebarVisibility } from '../lib/sidebarNavCatalog';

/** Shape returned by the lightweight sidebar-nav-visibility endpoint. */
type SidebarNavVisibilityResponse = { items: Record<string, boolean> };

export function useSidebarNavVisibility(activeBrandId: number | null) {
  const [visibility, setVisibility] = useState<Record<string, boolean> | null>(null);

  const load = useCallback(async () => {
    if (!activeBrandId) {
      setVisibility(null);
      return;
    }
    // Use the lightweight endpoint that does NOT require settings.view permission,
    // so every authenticated user respects the admin's sidebar configuration.
    const res = await api.get<SidebarNavVisibilityResponse>('settings/sidebar-nav-visibility');
    if (res.ok && res.data?.items) {
      setVisibility(mergeSidebarVisibility(res.data.items));
    } else {
      setVisibility(mergeSidebarVisibility(undefined));
    }
  }, [activeBrandId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onUpdate = () => void load();
    window.addEventListener(SIDEBAR_NAV_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(SIDEBAR_NAV_UPDATED_EVENT, onUpdate);
  }, [load]);

  return visibility;
}
