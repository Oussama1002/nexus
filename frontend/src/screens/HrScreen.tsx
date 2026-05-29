import React, { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { StatusChip } from '../components/ui/StatusChip';
import { cn } from '../lib/utils';
import type { User } from '../types';

type Collaborator = {
  id: string;
  name: string;
  role: User['role'];
  team: string;
  phone: string;
  status: 'Actif' | 'Inactif';
  joinedAt: string;
  performance: number; // 0..100
  lastLogin: string;
};

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: Parameters<typeof StatusChip>[0]['tone'] }) {
  return (
    <div className="card p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <p className="text-2xl font-black text-zinc-900">{value}</p>
        <StatusChip tone={tone ?? 'neutral'} />
      </div>
    </div>
  );
}

export function HrScreen({
  collaborators,
}: {
  collaborators: Collaborator[];
}) {
  const [tab, setTab] = useState<'Équipes' | 'Collaborateurs' | 'Activité' | 'Performance'>('Collaborateurs');
  const [q, setQ] = useState('');
  const [team, setTeam] = useState<string>('Toutes');
  const [role, setRole] = useState<string>('Tous');
  const [openId, setOpenId] = useState<string | null>(null);

  const teams = useMemo(() => ['Toutes', ...Array.from(new Set(collaborators.map((c) => c.team))).sort()], [collaborators]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return collaborators.filter((c) => {
      if (team !== 'Toutes' && c.team !== team) return false;
      if (role !== 'Tous' && c.role !== role) return false;
      if (!s) return true;
      const blob = `${c.name} ${c.phone} ${c.team} ${c.role} ${c.status}`.toLowerCase();
      return blob.includes(s);
    });
  }, [collaborators, q, team, role]);

  const selected = useMemo(() => collaborators.find((c) => c.id === openId) ?? null, [collaborators, openId]);

  const kpis = useMemo(() => {
    const active = collaborators.filter((c) => c.status === 'Actif');
    const confirmatrices = active.filter((c) => c.role === 'confirmatrice');
    const avgPerf = active.length ? Math.round(active.reduce((s, c) => s + c.performance, 0) / active.length) : 0;
    const inactive = collaborators.filter((c) => c.status === 'Inactif').length;
    const teamsCount = new Set(collaborators.map((c) => c.team)).size;
    const recentLogins = collaborators.filter((c) => c.lastLogin.includes('aujourd')).length;
    return { active: active.length, confirmatrices: confirmatrices.length, teams: teamsCount, avgPerf, recentLogins, inactive };
  }, [collaborators]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Espace RH / Supervision"
        subtitle="Gestion équipe, collaborateurs, activité et performance."
        right={
          <button
            onClick={() => alert('Ajouter collaborateur: placeholder')}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Ajouter
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Kpi label="Collaborateurs actifs" value={kpis.active} tone="success" />
        <Kpi label="Confirmatrices actives" value={kpis.confirmatrices} tone="info" />
        <Kpi label="Équipes" value={kpis.teams} />
        <Kpi label="Performance moyenne" value={`${kpis.avgPerf}%`} tone={kpis.avgPerf >= 80 ? 'success' : kpis.avgPerf >= 65 ? 'warning' : 'danger'} />
        <Kpi label="Connexions récentes" value={kpis.recentLogins} />
        <Kpi label="Comptes inactifs" value={kpis.inactive} tone={kpis.inactive > 0 ? 'warning' : 'success'} />
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        {(['Équipes', 'Collaborateurs', 'Activité', 'Performance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-black transition-colors',
              tab === t ? 'bg-primary-50 text-primary-700' : 'hover:bg-zinc-50 text-zinc-700',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Équipes' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card p-6">
            <p className="text-sm font-black text-zinc-900">Équipes</p>
            <p className="mt-1 text-xs font-medium text-zinc-500">Structure de supervision (placeholder enrichissable).</p>
            <div className="mt-5 space-y-3">
              {Array.from(new Set(collaborators.map((c) => c.team))).map((t) => (
                <div key={t} className="card-muted p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-zinc-900">{t}</p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">
                      Responsable: <span className="font-black">placeholder</span>
                    </p>
                  </div>
                  <StatusChip tone="neutral">
                    {collaborators.filter((c) => c.team === t).length} membres
                  </StatusChip>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6 space-y-2">
            <p className="text-sm font-black text-zinc-900">Gestion</p>
            <p className="text-sm font-medium text-zinc-600">
              Ajoute “responsables”, règles d’accès par marque, objectifs, et planification (à faire ensuite).
            </p>
          </div>
        </div>
      )}

      {tab === 'Collaborateurs' && (
        <>
          <FilterBar
            query={q}
            onQueryChange={setQ}
            left={
              <div className="flex items-center gap-3">
                <select value={team} onChange={(e) => setTeam(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
                  <option value="Tous">Tous rôles</option>
                  <option value="admin">admin</option>
                  <option value="manager">manager</option>
                  <option value="confirmatrice">confirmatrice</option>
                </select>
              </div>
            }
            right={<div className="text-sm font-black text-zinc-700">{filtered.length} collaborateurs</div>}
          />

          <DataTable
            rows={filtered}
            columns={[
              { key: 'name', header: 'Nom', cell: (r) => <button onClick={() => setOpenId(r.id)} className="font-black text-zinc-900 hover:underline">{r.name}</button> },
              { key: 'role', header: 'Rôle', cell: (r) => <span className="font-bold text-zinc-700">{r.role}</span> },
              { key: 'team', header: 'Équipe', cell: (r) => <span className="font-bold text-zinc-700">{r.team}</span> },
              { key: 'phone', header: 'Téléphone', cell: (r) => <span className="font-bold text-zinc-700">{r.phone}</span> },
              { key: 'status', header: 'Statut', cell: (r) => <StatusChip tone={r.status === 'Actif' ? 'success' : 'warning'}>{r.status}</StatusChip> },
              { key: 'joinedAt', header: "Date d'intégration", cell: (r) => <span className="font-bold text-zinc-700">{r.joinedAt}</span> },
              { key: 'performance', header: 'Performance', cell: (r) => <StatusChip tone={r.performance >= 80 ? 'success' : r.performance >= 65 ? 'warning' : 'danger'}>{r.performance}%</StatusChip> },
            ]}
            emptyTitle="Aucun collaborateur"
            emptyDescription="Aucun résultat pour les filtres actuels."
          />

          <Drawer
            open={Boolean(selected)}
            onClose={() => setOpenId(null)}
            title={selected ? selected.name : ''}
            subtitle={selected ? `${selected.role} • ${selected.team}` : ''}
            footer={
              <div className="flex items-center justify-between gap-3">
                <button className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50">
                  Statut compte
                </button>
                <button className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700">
                  Enregistrer (placeholder)
                </button>
              </div>
            }
          >
            {selected && (
              <div className="space-y-5">
                <div className="card-muted p-4">
                  <p className="text-xs font-black text-zinc-900">Infos personnelles / pro</p>
                  <div className="mt-3 space-y-2 text-sm font-bold text-zinc-700">
                    <div className="flex items-center justify-between">
                      <span>Téléphone</span>
                      <span className="text-zinc-900">{selected.phone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Statut</span>
                      <span className="text-zinc-900">{selected.status}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Dernière connexion</span>
                      <span className="text-zinc-900">{selected.lastLogin}</span>
                    </div>
                  </div>
                </div>

                <div className="card-muted p-4">
                  <p className="text-xs font-black text-zinc-900">Historique activité</p>
                  <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — à brancher sur `nexus.sessions` + backend.</p>
                </div>

                <div className="card-muted p-4">
                  <p className="text-xs font-black text-zinc-900">Stats productivité</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="card p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Performance</p>
                      <p className="mt-2 text-2xl font-black text-zinc-900">{selected.performance}%</p>
                    </div>
                    <div className="card p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">SLA</p>
                      <p className="mt-2 text-2xl font-black text-zinc-900">12 min</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Drawer>
        </>
      )}

      {tab === 'Activité' && (
        <div className="card p-6 space-y-2">
          <p className="text-sm font-black text-zinc-900">Activité</p>
          <p className="text-sm font-medium text-zinc-600">Placeholder — brancher sur `TrackingScreen` et sessions backend.</p>
        </div>
      )}

      {tab === 'Performance' && (
        <div className="card p-6 space-y-2">
          <p className="text-sm font-black text-zinc-900">Performance</p>
          <p className="text-sm font-medium text-zinc-600">Placeholder — scorecards, objectifs, comparaisons période.</p>
        </div>
      )}
    </div>
  );
}

