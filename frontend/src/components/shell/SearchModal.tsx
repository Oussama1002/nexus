import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { View } from '../../types';
import { pathForView } from '../../lib/appPaths';

type SearchEntry = {
  view: View;
  label: string;
  description: string;
  keywords: string;
};

const ENTRIES: SearchEntry[] = [
  { view: 'dashboard', label: 'Tableau de bord', description: 'KPIs, indicateurs, synthèse', keywords: 'dashboard kpi accueil' },
  { view: 'orders', label: 'Commandes', description: 'Liste des commandes', keywords: 'commandes orders' },
  { view: 'ordersNew', label: 'Nouvelle commande', description: 'Créer une commande', keywords: 'nouvelle commande create' },
  { view: 'leads', label: 'Leads', description: 'Gestion des leads', keywords: 'leads prospects' },
  { view: 'whatsapp', label: 'Conversations', description: 'WhatsApp & messages', keywords: 'whatsapp conversations messages chat' },
  { view: 'confirmatrice', label: 'Espace Confirmatrice', description: 'Workflow de confirmation', keywords: 'confirmatrice confirmation' },
  { view: 'customers', label: 'Clients', description: 'Fiches clients', keywords: 'clients customers' },
  { view: 'products', label: 'Produits', description: 'Catalogue produits', keywords: 'produits products catalogue' },
  { view: 'stock', label: 'Stock', description: 'Mouvements de stock', keywords: 'stock inventaire mouvements' },
  { view: 'suppliers', label: 'Fournisseurs', description: 'Gestion fournisseurs', keywords: 'fournisseurs suppliers' },
  { view: 'purchaseOrders', label: 'Achats fournisseurs', description: 'Bons de commande', keywords: 'achats purchase orders po' },
  { view: 'delivery', label: 'Livraison', description: 'Sociétés de livraison', keywords: 'livraison delivery transporteurs' },
  { view: 'deliveryDashboard', label: 'KPI Livraison', description: 'Dashboard livraison', keywords: 'kpi livraison delivery dashboard' },
  { view: 'trackingParcels', label: 'Colis', description: 'Tracking colis', keywords: 'colis parcels shipments tracking' },
  { view: 'ads', label: 'Campagnes Ads', description: 'Comptes & campagnes pub', keywords: 'ads campagnes publicité meta' },
  { view: 'mediaBuying', label: 'Media Buying', description: 'Achats médias', keywords: 'media buying achat' },
  { view: 'socialMedia', label: 'Social Media', description: 'Comptes sociaux, calendrier', keywords: 'social media réseaux sociaux' },
  { view: 'influenceHub', label: 'Influence', description: 'Influenceurs & collaborations', keywords: 'influence influenceurs' },
  { view: 'finance', label: 'Finance', description: 'Charges, factures, contrats', keywords: 'finance charges factures' },
  { view: 'hr', label: 'Ressources Humaines', description: 'Collaborateurs, présence, paie', keywords: 'rh hr collaborateurs employés' },
  { view: 'academy', label: 'Academy', description: 'Formation interne', keywords: 'academy formation leçons' },
  { view: 'reporting', label: 'Reportings', description: 'Rapports & analyses', keywords: 'reporting rapports' },
  { view: 'settings', label: 'Paramètres', description: 'Centre de paramètres', keywords: 'paramètres settings configuration' },
  { view: 'usersAdmin', label: 'Utilisateurs', description: 'Gestion utilisateurs', keywords: 'utilisateurs users admin' },
  { view: 'brands', label: 'Marques', description: 'Gestion des marques', keywords: 'marques brands' },
  { view: 'profile', label: 'Mon profil', description: 'Informations personnelles', keywords: 'profil profile compte' },
];

export function SearchModal({
  open,
  onClose,
  navigate,
  canAccess,
}: {
  open: boolean;
  onClose: () => void;
  navigate: (path: string) => void;
  canAccess: (v: View) => boolean;
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQ('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard shortcut: Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (!open) {
          // Parent will handle opening
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const results = useMemo(() => {
    const available = ENTRIES.filter((e) => canAccess(e.view));
    if (!q.trim()) return available;
    const s = q.trim().toLowerCase();
    return available.filter(
      (e) =>
        e.label.toLowerCase().includes(s) ||
        e.description.toLowerCase().includes(s) ||
        e.keywords.toLowerCase().includes(s),
    );
  }, [q, canAccess]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [q]);

  const go = useCallback(
    (view: View) => {
      navigate(pathForView(view));
      onClose();
    },
    [navigate, onClose],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIdx]) {
        go(results[selectedIdx].view);
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [results, selectedIdx, go, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher un écran, module…"
            className="flex-1 text-sm font-medium outline-none bg-transparent"
          />
          <kbd className="hidden sm:block text-[10px] font-bold text-zinc-400 border border-zinc-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm font-medium text-zinc-400">Aucun résultat.</p>
          ) : (
            results.map((entry, i) => (
              <button
                key={entry.view}
                type="button"
                onClick={() => go(entry.view)}
                onMouseEnter={() => setSelectedIdx(i)}
                className={cn(
                  'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
                  i === selectedIdx ? 'bg-primary-50' : 'hover:bg-zinc-50',
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-bold', i === selectedIdx ? 'text-primary-700' : 'text-zinc-900')}>
                    {entry.label}
                  </p>
                  <p className="text-xs font-medium text-zinc-500 truncate">{entry.description}</p>
                </div>
                {i === selectedIdx && (
                  <kbd className="text-[10px] font-bold text-primary-400 border border-primary-200 rounded px-1.5 py-0.5">
                    Entrée
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
