import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Brand } from '../types';
import { useAuth } from './AuthContext';

const ACTIVE_BRAND_KEY = 'nexus_active_brand_id';

export type UiBrand = Brand & {
  status?: 'Actif' | 'Inactif';
  code?: string;
  contact?: string;
  note?: string;
};

function readStoredBrandId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_BRAND_KEY) ?? localStorage.getItem('nexus.activeBrandId');
  } catch {
    return null;
  }
}

function writeStoredBrandId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_BRAND_KEY, id);
    else localStorage.removeItem(ACTIVE_BRAND_KEY);
  } catch {
    // ignore
  }
}

function apiBrandToUi(b: {
  id: number;
  name: string;
  code: string;
  status: string;
  whatsapp_number?: string[] | null;
}): UiBrand {
  const code = b.code ?? String(b.id);
  const words = b.name.trim().split(/\s+/);
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : b.name.slice(0, 2).toUpperCase();
  const palette = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];
  const color = palette[Math.abs(b.id) % palette.length];
  const statusFr: 'Actif' | 'Inactif' = b.status === 'active' ? 'Actif' : 'Inactif';
  const nums = b.whatsapp_number ?? [];
  return {
    id: String(b.id),
    name: b.name,
    logo: initials,
    color,
    whatsappNumber: Array.isArray(nums) ? nums.join(', ') : String(nums),
    status: statusFr,
    code,
    contact: '',
    note: '',
  };
}

const FALLBACK_BRAND: UiBrand = {
  id: '0',
  name: '—',
  logo: '—',
  color: '#71717a',
  whatsappNumber: '',
  status: 'Inactif',
  code: '',
  contact: '',
  note: '',
};

type BrandContextValue = {
  brands: UiBrand[];
  activeBrandId: string;
  setActiveBrandId: (id: string) => void;
  activeBrand: UiBrand;
};

const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { accessibleBrands } = useAuth();

  const brands = useMemo(() => accessibleBrands.map((b) => apiBrandToUi(b)), [accessibleBrands]);

  const [activeBrandId, setActiveBrandIdState] = useState<string>(() => readStoredBrandId() ?? '');

  useEffect(() => {
    if (!brands.length) {
      setActiveBrandIdState('');
      return;
    }
    const ids = new Set(brands.map((b) => b.id));
    if (!activeBrandId || (activeBrandId !== 'all' && !ids.has(activeBrandId))) {
      writeStoredBrandId('all');       // sync localStorage BEFORE child effects
      setActiveBrandIdState('all');
    }
  }, [brands, activeBrandId]);

  const setActiveBrandId = useCallback((id: string) => {
    writeStoredBrandId(id);          // sync localStorage BEFORE re-render
    setActiveBrandIdState(id);
  }, []);

  const ALL_BRAND: UiBrand = useMemo(() => ({
    id: 'all',
    name: 'Toutes les marques',
    logo: '∗',
    color: '#3b82f6',
    whatsappNumber: '',
    status: 'Actif',
    code: 'ALL',
    contact: '',
    note: '',
  }), []);

  const value = useMemo<BrandContextValue>(() => {
    const list = brands.length ? brands : [];
    const isAll = activeBrandId === 'all';
    const id = isAll ? 'all' : (activeBrandId && list.some((b) => b.id === activeBrandId) ? activeBrandId : list[0]?.id ?? '');
    const active = isAll ? ALL_BRAND : (list.find((b) => b.id === id) ?? FALLBACK_BRAND);
    return {
      brands: list,
      activeBrandId: id,
      setActiveBrandId,
      activeBrand: active,
    };
  }, [brands, activeBrandId, setActiveBrandId, ALL_BRAND]);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within BrandProvider');
  return ctx;
}
