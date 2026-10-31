import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, LifeBuoy, MessageSquareText, Package, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useBrand } from '../context/BrandContext';
import * as api from '../lib/api';

type CmReference = {
  visible: boolean;
  brand: { id: number; name: string; color: string | null };
  presentation?: string | null;
  tone_rules?: string | null;
  canned_replies?: string | null;
  faq?: string | null;
  escalation_contacts?: string | null;
  products?: string[];
};

/**
 * Fiche de référence marque en lecture seule pour le Community Manager
 * (spec Droits CM §6). Limitée à la marque active (attribuée au CM), sans
 * aucune donnée de vente ni financière.
 */
export function BrandCmReferenceScreen() {
  const { activeBrandId, activeBrand } = useBrand();
  const [ref, setRef] = useState<CmReference | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBrandId || activeBrandId === 'all') {
      setRef(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await api.get<CmReference>('brands/cm-reference', { brandId: activeBrandId });
    setLoading(false);
    if (res.ok && res.data) {
      setRef(res.data);
    } else {
      setRef(null);
      setError(res.message);
    }
  }, [activeBrandId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!activeBrandId || activeBrandId === 'all') {
    return (
      <div className="space-y-6">
        <PageHeader title="Fiche marque" subtitle="Référence pour répondre aux clients." />
        <EmptyState title="Choisissez une marque" description="Sélectionnez une marque dans la barre du haut pour voir sa fiche." />
      </div>
    );
  }

  const brandName = ref?.brand.name ?? activeBrand?.name ?? 'Marque';

  return (
    <div className="space-y-6">
      <PageHeader title={`Fiche marque — ${brandName}`} subtitle="Informations utiles pour répondre aux clients (consultation)." />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div>
      )}
      {loading && !ref && <p className="text-sm font-bold text-zinc-500">Chargement de la fiche…</p>}

      {ref && !ref.visible && (
        <EmptyState
          title="Fiche non disponible"
          description="La fiche de cette marque n’a pas encore été publiée pour les community managers."
        />
      )}

      {ref && ref.visible && (
        <div className="space-y-5">
          <Section icon={Sparkles} title="Présentation" text={ref.presentation} />
          <Section icon={BookOpen} title="Ton & règles de réponse" text={ref.tone_rules} />
          <Section icon={MessageSquareText} title="Réponses types" text={ref.canned_replies} />
          <Section icon={BookOpen} title="FAQ" text={ref.faq} />
          <Section icon={LifeBuoy} title="Contacts d’escalade" text={ref.escalation_contacts} />

          {ref.products && ref.products.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary-600" />
                <p className="text-sm font-black text-zinc-900">Produits</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {ref.products.map((p) => (
                  <span key={p} className="px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700">{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text?: string | null }) {
  if (!text || !text.trim()) return null;
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary-600" />
        <p className="text-sm font-black text-zinc-900">{title}</p>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-zinc-700">{text}</p>
    </div>
  );
}
