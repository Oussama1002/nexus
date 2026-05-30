import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';
import type { GeneralModel } from '../lib/settingsCenterApi';
import { SIDEBAR_NAV_UPDATED_EVENT, mergeSidebarVisibility } from '../lib/sidebarNavCatalog';

export function useSidebarNavVisibility(activeBrandId: number | null) {
  const [visibility, setVisibility] = useState<Record<string, boolean> | null>(null);

  const load = useCallback(async () => {
    if (!activeBrandId) {
      setVisibility(null);
      return;
    }
    const res = await api.get<GeneralModel>(`settings/center/${encodeURIComponent('general')}`);
    if (res.ok && res.data?.navigation?.items) {
      setVisibility(mergeSidebarVisibility(res.data.navigation.items));
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
