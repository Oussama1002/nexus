import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';

type Attendance = {
  id: number; attendance_date: string; clock_in_at: string | null; clock_out_at: string | null;
  status: string | null; was_late: boolean; minutes_late: number | null; justification_status: string | null;
};
type Leave = { id: number; leave_type: string; start_date: string; end_date: string; days_count: number; reason: string | null; status: string };
type Payload = {
  employee: { full_name: string; role_title: string | null; department: string | null; phone: string | null; email: string | null; status: string | null } | null;
  attendance: Attendance[];
  attendance_summary: { present: number; late: number; absent: number; total: number };
  leaves: Leave[];
};

const LEAVE_TYPES = [
  { v: 'conge_paye', l: 'Congé payé' },
  { v: 'maladie', l: 'Maladie' },
  { v: 'sans_solde', l: 'Sans solde' },
  { v: 'autre', l: 'Autre' },
];
function leaveTypeLabel(v: string) { return LEAVE_TYPES.find((x) => x.v === v)?.l ?? v; }
// Les pointages sont gérés en heure du Maroc (Africa/Casablanca) alors que la
// base stocke en UTC : on affiche donc explicitement dans ce fuseau.
const TZ = 'Africa/Casablanca';
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { timeZone: TZ });
}
function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}
function leaveStatusTone(s: string): 'warning' | 'success' | 'danger' | 'neutral' {
  if (s === 'approved' || s === 'approuve') return 'success';
  if (s === 'refused' || s === 'refuse') return 'danger';
  if (s === 'pending' || s === 'en_attente') return 'warning';
  return 'neutral';
}

export function MyHrFileScreen() {
  const toast = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [lt, setLt] = useState('conge_paye');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [leaveSaving, setLeaveSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<Payload>('hr/my-file');
    setLoading(false);
    if (res.ok && res.data) setData(res.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const daysCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const a = new Date(startDate); const b = new Date(endDate);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
    return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  }, [startDate, endDate]);

  async function requestLeave() {
    if (!startDate || !endDate || daysCount < 1) { toast.error('Dates de congé invalides.'); return; }
    setLeaveSaving(true);
    const res = await api.post('hr/leaves', { leave_type: lt, start_date: startDate, end_date: endDate, days_count: daysCount, reason: reason.trim() || null });
    setLeaveSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Demande de congé envoyée.');
    setLeaveOpen(false); setStartDate(''); setEndDate(''); setReason('');
    await load();
  }

  const emp = data?.employee;
  const s = data?.attendance_summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon dossier"
        subtitle="Votre fiche, votre présence et vos congés. Le pointage est automatique à la connexion."
      />

      {loading ? (
        <p className="text-sm font-bold text-zinc-500">Chargement…</p>
      ) : (
        <>
          {/* Ma fiche */}
          <section className="card p-6">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3">Ma fiche</p>
            {emp ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                <Info label="Nom" value={emp.full_name} />
                <Info label="Fonction" value={emp.role_title ?? '—'} />
                <Info label="Département" value={emp.department ?? '—'} />
                <Info label="Téléphone" value={emp.phone ?? '—'} />
                <Info label="E-mail" value={emp.email ?? '—'} />
                <Info label="Statut" value={emp.status ?? '—'} />
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Aucune fiche employé liée à votre compte. Contactez les RH.</p>
            )}
          </section>

          {/* Présence du mois */}
          <section className="card p-6">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3">Présence & pointage — ce mois</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[{ l: 'Jours présents', v: s?.present ?? 0 }, { l: 'Retards', v: s?.late ?? 0 }, { l: 'Absences', v: s?.absent ?? 0 }, { l: 'Jours enregistrés', v: s?.total ?? 0 }].map((k) => (
                <div key={k.l} className="card-muted p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{k.l}</p>
                  <p className="mt-1 text-2xl font-black text-zinc-900">{k.v}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {(data?.attendance ?? []).slice(0, 15).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 text-sm">
                  <span className="font-bold text-zinc-800">{fmtDate(r.attendance_date)}</span>
                  <span className="text-zinc-500">{fmtTime(r.clock_in_at)} → {fmtTime(r.clock_out_at)}</span>
                  <span className="flex items-center gap-2">
                    {r.was_late && <StatusChip tone="warning">Retard{r.minutes_late ? ` ${r.minutes_late}′` : ''}</StatusChip>}
                    <StatusChip tone={r.status === 'present' ? 'success' : r.status === 'absent' ? 'danger' : 'neutral'}>{r.status ?? '—'}</StatusChip>
                  </span>
                </div>
              ))}
              {(data?.attendance ?? []).length === 0 && <p className="text-sm text-zinc-500">Aucun pointage enregistré.</p>}
            </div>
          </section>

          {/* Mes congés */}
          <section className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Congés & absences</p>
              <button type="button" onClick={() => setLeaveOpen(true)} className="px-3 py-1.5 rounded-xl border border-zinc-200 text-sm font-black inline-flex items-center gap-2 hover:bg-zinc-50">
                <Plus className="w-4 h-4" /> Demander un congé
              </button>
            </div>
            <div className="space-y-1.5">
              {(data?.leaves ?? []).map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 text-sm">
                  <span className="font-bold text-zinc-800">{leaveTypeLabel(l.leave_type)}</span>
                  <span className="text-zinc-500 inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {fmtDate(l.start_date)} → {fmtDate(l.end_date)} · {l.days_count} j</span>
                  <StatusChip tone={leaveStatusTone(l.status)}>{l.status}</StatusChip>
                </div>
              ))}
              {(data?.leaves ?? []).length === 0 && <p className="text-sm text-zinc-500">Aucune demande de congé.</p>}
            </div>
          </section>
        </>
      )}

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Demander un congé"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setLeaveOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-black">Fermer</button>
            <button type="button" disabled={leaveSaving} onClick={() => void requestLeave()} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-50">{leaveSaving ? 'Envoi…' : 'Envoyer la demande'}</button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-black uppercase text-zinc-700">Type
            <select value={lt} onChange={(e) => setLt(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold">
              {LEAVE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-700">Du
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
            </label>
            <label className="block text-xs font-black uppercase text-zinc-700">Au
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
            </label>
          </div>
          <p className="text-[11px] font-bold text-zinc-500">{daysCount > 0 ? `${daysCount} jour(s)` : 'Choisissez les dates.'}</p>
          <label className="block text-xs font-black uppercase text-zinc-700">Motif
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
          </label>
        </div>
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="text-sm font-bold text-zinc-900">{value}</p>
    </div>
  );
}

export default MyHrFileScreen;
