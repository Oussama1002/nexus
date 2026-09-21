import React, { useEffect, useState } from 'react';
import { formatLateness } from '../../lib/utils';
import { AlertTriangle, Clock } from 'lucide-react';
import * as api from '../../lib/api';
import { useToast } from '../../context/ToastContext';

type Pending = { id: number; minutes_late: number; clock_in_at: string | null };

/**
 * Pops up once when the user logs in late (LoginPage set the
 * "nexus:late_justify_prompt" key in sessionStorage) so they can
 * submit a justification that lands on today's HrAttendance record.
 * Blocks the shell with an overlay — the user can dismiss with "Plus
 * tard", but the key stays so the next login re-prompts if they never
 * filled it.
 */
export function LateJustificationModal() {
  const toast = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('nexus:late_justify_prompt');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Pending;
      if (parsed && typeof parsed.id === 'number') setPending(parsed);
    } catch { /* ignore */ }
  }, []);

  if (!pending) return null;

  const submit = async () => {
    if (!reason.trim()) { toast.error('La justification est obligatoire.'); return; }
    setSaving(true);
    const res = await api.patch(`hr/attendance/${pending.id}/justify`, {
      justification_reason: reason.trim(),
    });
    setSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Justification enregistrée. En attente de validation manager.');
    try { sessionStorage.removeItem('nexus:late_justify_prompt'); } catch { /* ignore */ }
    setPending(null);
  };

  const later = () => setPending(null);

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-black text-zinc-900">Retard détecté</p>
            <p className="text-sm text-zinc-600 mt-1 leading-snug">
              Vous avez pointé en retard de <span className="font-black text-rose-700">{formatLateness(pending.minutes_late)}</span>
              {pending.clock_in_at ? <> à <span className="font-black">{pending.clock_in_at}</span></> : null}.
              Merci de justifier votre retard — la justification sera transmise à votre manager pour validation.
            </p>
          </div>
        </div>

        <label className="block text-xs font-bold text-zinc-500">
          Motif du retard
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Ex : Panne de transport, rendez-vous médical, embouteillage…"
            className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            autoFocus
          />
        </label>

        <p className="text-[11px] text-zinc-500 inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          La justification est associée à votre pointage du jour, visible dans Présence &amp; Pointage.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={later}
            className="flex-1 py-2.5 rounded-xl border border-zinc-200 font-black text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Plus tard
          </button>
          <button
            type="button"
            disabled={saving || !reason.trim()}
            onClick={() => void submit()}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-black text-sm shadow-md shadow-primary-100 hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Envoi…' : 'Soumettre'}
          </button>
        </div>
      </div>
    </div>
  );
}
