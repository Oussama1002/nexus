import React, { useEffect, useState } from 'react';
import { Clock, MessageSquare, Shield, Activity } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import * as api from '../../lib/api';
import { AUDIT_ENTITY_LABELS_FR, AUDIT_ACTION_LABELS_FR } from '../../lib/auditDisplayFr';
import { organizationRoleLabel } from '../../lib/organizationRoles';

type AttendanceRecord = {
  id: number;
  attendance_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  status: string;
  was_late: boolean;
  minutes_late: number;
};

type AuditEntry = {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
  ip_address: string | null;
};

type InternalMsg = {
  id: number;
  sender_id: number;
  receiver_id: number;
  body: string;
  read_at: string | null;
  created_at: string;
  sender?: { id: number; name: string } | null;
  receiver?: { id: number; name: string } | null;
};

type UserDetail = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  created_at: string;
  roles: { id: number; name: string; slug: string }[];
  brands: { id: number; name: string }[];
  employee?: {
    id: number;
    full_name: string;
    role_title?: string | null;
    department?: string | null;
    work_start_time?: string | null;
    work_end_time?: string | null;
    lunch_start_time?: string | null;
    lunch_end_time?: string | null;
    work_days?: string[] | null;
  } | null;
  attendance_history: AttendanceRecord[];
  recent_activity: AuditEntry[];
  recent_messages: InternalMsg[];
};

const ATTENDANCE_STATUS: Record<string, { label: string; color: string }> = {
  present: { label: 'Présent', color: 'text-emerald-700 bg-emerald-50' },
  late: { label: 'En retard', color: 'text-amber-700 bg-amber-50' },
  absent: { label: 'Absent', color: 'text-rose-700 bg-rose-50' },
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function fmtFullDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { dateStyle: 'medium' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function fmtTime(t: string | null | undefined): string {
  if (!t) return '—';
  return t.slice(0, 5);
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 space-y-3">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-primary-700 flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,38%)_1fr] gap-x-3 gap-y-0.5 text-sm border-b border-zinc-100/90 pb-2 last:border-0">
      <span className="text-zinc-500 font-bold">{label}</span>
      <span className="text-zinc-900 font-medium break-words">{value ?? '—'}</span>
    </div>
  );
}

type Props = {
  userId: number | null;
  open: boolean;
  onClose: () => void;
};

export function UserFicheDrawer({ userId, open, onClose }: Props) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'presence' | 'activity' | 'messages'>('presence');

  useEffect(() => {
    if (!open || !userId) {
      setUser(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await api.get<UserDetail>(`users/${userId}`);
      if (cancelled) return;
      setLoading(false);
      if (res.ok && res.data) setUser(res.data);
      else setUser(null);
    })();
    return () => { cancelled = true; };
  }, [open, userId]);

  const tabs = [
    { key: 'presence' as const, label: 'Présence', icon: <Clock className="w-3.5 h-3.5" /> },
    { key: 'activity' as const, label: 'Activité', icon: <Activity className="w-3.5 h-3.5" /> },
    { key: 'messages' as const, label: 'Messages', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  ];

  return (
    <Drawer
      open={open && userId !== null}
      onClose={onClose}
      widthClassName="w-[min(100vw,600px)]"
      title={user ? user.name : 'Fiche utilisateur'}
      subtitle={user?.email}
    >
      {loading && <p className="text-sm font-bold text-zinc-500">Chargement…</p>}
      {!loading && !user && <p className="text-sm text-zinc-600">Impossible de charger la fiche utilisateur.</p>}
      {user && (
        <div className="space-y-4">
          <Section title="Informations" icon={<Shield className="w-3.5 h-3.5" />}>
            <Row label="Nom" value={user.name} />
            <Row label="Email" value={user.email} />
            <Row label="Téléphone" value={user.phone} />
            <Row label="Statut" value={
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}>
                {user.status === 'active' ? 'Actif' : user.status === 'inactive' ? 'Inactif' : user.status}
              </span>
            } />
            <Row label="Rôles" value={
              <div className="flex flex-wrap gap-1">
                {user.roles.map((r) => (
                  <span key={r.id} className="px-2 py-0.5 rounded-lg bg-primary-50 text-primary-700 text-[10px] font-bold">
                    {organizationRoleLabel(r.slug, r.name)}
                  </span>
                ))}
              </div>
            } />
            <Row label="Marques" value={
              user.brands.length > 0
                ? <div className="flex flex-wrap gap-1">{user.brands.map((b) => <span key={b.id} className="px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-700 text-[10px] font-bold">{b.name}</span>)}</div>
                : '—'
            } />
            <Row label="Créé le" value={fmtDate(user.created_at)} />
            {user.employee && (
              <>
                <Row label="Poste" value={user.employee.role_title} />
                <Row label="Département" value={user.employee.department} />
                <Row label="Horaires" value={`${fmtTime(user.employee.work_start_time)} - ${fmtTime(user.employee.work_end_time)}`} />
                {user.employee.lunch_start_time && user.employee.lunch_end_time && (
                  <Row label="Pause déjeuner" value={`${fmtTime(user.employee.lunch_start_time)} - ${fmtTime(user.employee.lunch_end_time)}`} />
                )}
                {user.employee.work_days && user.employee.work_days.length > 0 && (
                  <Row label="Jours" value={
                    <div className="flex flex-wrap gap-1">
                      {user.employee.work_days.map((d) => (
                        <span key={d} className="px-2 py-0.5 rounded-lg bg-primary-50 text-primary-700 text-[10px] font-bold capitalize">{d}</span>
                      ))}
                    </div>
                  } />
                )}
              </>
            )}
          </Section>

          {/* Tab navigation */}
          <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-colors ${
                  tab === t.key ? 'bg-white text-primary-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Presence tab */}
          {tab === 'presence' && (
            <Section title="Historique de présence (30 derniers jours)" icon={<Clock className="w-3.5 h-3.5" />}>
              {user.attendance_history.length === 0 ? (
                <p className="text-xs text-zinc-500">Aucun enregistrement de présence.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className="text-left py-1.5 font-black text-zinc-500">Date</th>
                        <th className="text-left py-1.5 font-black text-zinc-500">Entrée</th>
                        <th className="text-left py-1.5 font-black text-zinc-500">Sortie</th>
                        <th className="text-left py-1.5 font-black text-zinc-500">Statut</th>
                        <th className="text-left py-1.5 font-black text-zinc-500">Retard</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {user.attendance_history.map((a) => {
                        const st = ATTENDANCE_STATUS[a.status] ?? { label: a.status, color: 'text-zinc-700 bg-zinc-50' };
                        return (
                          <tr key={a.id}>
                            <td className="py-1.5 font-medium">{fmtDate(a.attendance_date)}</td>
                            <td className="py-1.5">{fmtDateTime(a.clock_in_at)}</td>
                            <td className="py-1.5">{fmtDateTime(a.clock_out_at)}</td>
                            <td className="py-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${st.color}`}>{st.label}</span>
                            </td>
                            <td className="py-1.5">{a.was_late ? `${a.minutes_late} min` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {/* Activity tab */}
          {tab === 'activity' && (
            <Section title="Activité récente (30 dernières actions)" icon={<Activity className="w-3.5 h-3.5" />}>
              {user.recent_activity.length === 0 ? (
                <p className="text-xs text-zinc-500">Aucune activité récente.</p>
              ) : (
                <div className="space-y-2">
                  {user.recent_activity.map((a) => {
                    const actionLabel = AUDIT_ACTION_LABELS_FR[a.action] ?? a.action;
                    const entityLabel = a.entity_type ? (AUDIT_ENTITY_LABELS_FR[a.entity_type] ?? a.entity_type.split('\\').pop()) : '';
                    return (
                      <div key={a.id} className="flex items-start gap-3 py-2 border-b border-zinc-100 last:border-0">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-primary-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-zinc-900">{actionLabel}</p>
                          {entityLabel && a.entity_id && (
                            <p className="text-[10px] text-zinc-500">{entityLabel} #{a.entity_id}</p>
                          )}
                          <p className="text-[10px] text-zinc-400 mt-0.5">{fmtFullDateTime(a.created_at)}</p>
                        </div>
                        {a.ip_address && (
                          <span className="text-[10px] text-zinc-400 font-mono shrink-0">{a.ip_address}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}

          {/* Messages tab */}
          {tab === 'messages' && (
            <Section title="Messages internes récents" icon={<MessageSquare className="w-3.5 h-3.5" />}>
              {user.recent_messages.length === 0 ? (
                <p className="text-xs text-zinc-500">Aucun message interne.</p>
              ) : (
                <div className="space-y-2">
                  {user.recent_messages.map((m) => {
                    const isSender = m.sender_id === user.id;
                    const peerName = isSender ? m.receiver?.name : m.sender?.name;
                    return (
                      <div key={m.id} className="py-2 border-b border-zinc-100 last:border-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isSender ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-600'}`}>
                            {isSender ? 'Envoyé' : 'Reçu'}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-700">
                            {isSender ? `→ ${peerName ?? '?'}` : `← ${peerName ?? '?'}`}
                          </span>
                          <span className="text-[10px] text-zinc-400 ml-auto">{fmtFullDateTime(m.created_at)}</span>
                        </div>
                        <p className="text-xs text-zinc-800 line-clamp-2">{m.body}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}
        </div>
      )}
    </Drawer>
  );
}
