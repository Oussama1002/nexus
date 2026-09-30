import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Brand } from '../types';
import { useAuth } from './AuthContext';
import { setBrandPrompt } from '../lib/api';

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

  // Une action a besoin d'une marque : on la demande sans quitter la page,
  // et la requete est rejouee avec le choix.
  const [pendingPick, setPendingPick] = useState<((id: string | null) => void) | null>(null);

  useEffect(() => {
    setBrandPrompt(() => new Promise<string | null>((resolve) => setPendingPick(() => resolve)));
    return () => setBrandPrompt(null);
  }, []);

  const answerPick = useCallback(
    (id: string | null) => {
      if (id) {
        setActiveBrandIdState(id);
        writeStoredBrandId(id);
      }
      setPendingPick((resolve) => {
        resolve?.(id);
        return null;
      });
    },
    [],
  );

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

  return (
    <BrandContext.Provider value={value}>
      {children}

      {pendingPick && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-black text-zinc-900">Choisissez une marque</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Cette action doit être rattachée à une marque. Sélectionnez-la et elle se poursuit
                automatiquement.
              </p>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => answerPick(b.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-left hover:border-primary-300 hover:bg-primary-50"
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-black text-white"
                    style={{ background: b.color }}
                  >
                    {b.logo}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-zinc-900">{b.name}</span>
                    {b.code && <span className="block text-xs font-semibold text-zinc-500">{b.code}</span>}
                  </span>
                </button>
              ))}
              {brands.length === 0 && (
                <p className="text-sm font-semibold text-zinc-500">
                  Aucune marque ne vous est assignée. Contactez un administrateur.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => answerPick(null)}
              className="w-full rounded-xl border border-zinc-300 py-2.5 text-sm font-black text-zinc-700 hover:bg-zinc-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within BrandProvider');
  return ctx;
}
