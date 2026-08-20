import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle2, Lock } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type PeriodRow = {
  id: number; year: number; month: number; status: string;
  bulletins_count?: number;
  validated_at: string | null;
  validated_by?: { id: number; name: string } | null;
};

type BulletinRow = {
  id: number;
  employee_id: number;
  employee?: { id: number; full_name: string; employee_code: string };
  payroll_period?: { id: number; year: number; month: number; status: string };
  base_salary: number;
  primes: number;
  indemnites: number;
  retenues: number;
  absence_deduction: number;
  cnss_employee: number;
  ir: number;
  net_salary: number;
  status: string;
};

type EmpOpt = { id: number; full_name: string; salary?: number };

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const money = (n: number | string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(Number(n || 0));

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ouvert: { label: 'Ouvert', cls: 'bg-blue-50 text-blue-700' },
  valide: { label: 'Validé', cls: 'bg-emerald-50 text-emerald-700' },
  cloture: { label: 'Clôturé', cls: 'bg-zinc-100 text-zinc-500' },
  brouillon: { label: 'Brouillon', cls: 'bg-amber-50 text-amber-700' },
};

export function PayrollScreen() {
  const toast = useToast();
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [bulletins, setBulletins] = useState<BulletinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmpOpt[]>([]);

  const [showPeriod, setShowPeriod] = useState(false);
  const [pForm, setPForm] = useState({ year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1) });

  const [showBulletin, setShowBulletin] = useState(false);
  const [bForm, setBForm] = useState({
    employee_id: '', base_salary: '', primes: '', indemnites: '', retenues: '',
    absence_deduction: '', cnss_employee: '', ir: '', net_salary: '',
  });

  const loadPeriods = async () => {
    const res = await api.get<Paginated<PeriodRow>>('hr/payroll-periods' + buildQuery({ per_page: 24 }));
    if (res.ok) {
      setPeriods(res.data.data);
      if (!selectedPeriod && res.data.data.length > 0) setSelectedPeriod(res.data.data[0].id);
    }
  };

  const loadBulletins = async (periodId: number) => {
    setLoading(true);
    const res = await api.get<Paginated<BulletinRow>>('hr/payroll-bulletins' + buildQuery({ per_page: 100, payroll_period_id: periodId }));
    setLoading(false);
    if (!res.ok) { toast.error(res.message); setBulletins([]); return; }
    setBulletins(res.data.data);
  };

  useEffect(() => { loadPeriods(); }, []); // eslint-disable-line
  useEffect(() => { if (selectedPeriod) loadBulletins(selectedPeriod); }, [selectedPeriod]);
  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<EmpOpt>>('hr' + buildQuery({ per_page: 100 }));
      if (res.ok) setEmployees(res.data.data.map((e: any) => ({ id: e.id, full_name: e.full_name, salary: e.salary })));
    })();
  }, []);

  const savePeriod = async () => {
    const res = await api.post('hr/payroll-periods', { year: Number(pForm.year), month: Number(pForm.month) });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Période créée.'); setShowPeriod(false); loadPeriods();
  };

  const validatePeriod = async (id: number) => {
    if (!confirm('Valider cette période ? Les bulletins seront verrouillés.')) return;
    const res = await api.post(`hr/payroll-periods/${id}/validate`, {});
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Période validée.'); loadPeriods();
  };

  const closePeriod = async (id: number) => {
    if (!confirm('Clôturer cette période ?')) return;
    const res = await api.post(`hr/payroll-periods/${id}/close`, {});
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Clôturée.'); loadPeriods();
  };

  const openBulletin = (employeeId?: number) => {
    const emp = employees.find((e) => e.id === employeeId);
    setBForm({
      employee_id: employeeId ? String(employeeId) : '',
      base_salary: emp?.salary ? String(emp.salary) : '',
      primes: '', indemnites: '', retenues: '', absence_deduction: '',
      cnss_employee: '', ir: '', net_salary: emp?.salary ? String(emp.salary) : '',
    });
    setShowBulletin(true);
  };

  const saveBulletin = async () => {
    if (!selectedPeriod || !bForm.employee_id || !bForm.base_salary || !bForm.net_salary) {
      toast.error('Employé, salaire de base et net requis.'); return;
    }
    const res = await api.post('hr/payroll-bulletins', {
      payroll_period_id: selectedPeriod,
      employee_id: Number(bForm.employee_id),
      base_salary: Number(bForm.base_salary),
      primes: Number(bForm.primes || 0),
      indemnites: Number(bForm.indemnites || 0),
      retenues: Number(bForm.retenues || 0),
      absence_deduction: Number(bForm.absence_deduction || 0),
      cnss_employee: Number(bForm.cnss_employee || 0),
      ir: Number(bForm.ir || 0),
      net_salary: Number(bForm.net_salary),
    });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Bulletin créé.'); setShowBulletin(false);
    if (selectedPeriod) loadBulletins(selectedPeriod);
  };

  const validateBulletin = async (id: number) => {
    if (!confirm('Valider ce bulletin ? Il deviendra immuable.')) return;
    const res = await api.post(`hr/payroll-bulletins/${id}/validate`, {});
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Validé.'); if (selectedPeriod) loadBulletins(selectedPeriod);
  };

  const currentPeriod = periods.find((p) => p.id === selectedPeriod);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paie"
        subtitle="Périodes de paie et bulletins"
        right={
          <button onClick={() => setShowPeriod(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle période
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPeriod(p.id)}
            className={`px-3 py-2 rounded-xl text-sm font-black border ${selectedPeriod === p.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-zinc-700 border-zinc-200'}`}
          >
            {MONTHS[p.month - 1]} {p.year}
          </button>
        ))}
      </div>

      {currentPeriod && (
        <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-zinc-900">{MONTHS[currentPeriod.month - 1]} {currentPeriod.year}</p>
            <p className="text-xs text-zinc-500">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase mr-2 ${STATUS_BADGE[currentPeriod.status]?.cls ?? 'bg-zinc-100'}`}>
                {STATUS_BADGE[currentPeriod.status]?.label ?? currentPeriod.status}
              </span>
              {currentPeriod.bulletins_count ?? 0} bulletins
            </p>
          </div>
          <div className="flex gap-2">
            {currentPeriod.status === 'ouvert' && (
              <>
                <button onClick={() => openBulletin()} className="px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Bulletin
                </button>
                <button onClick={() => validatePeriod(currentPeriod.id)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Valider la période
                </button>
              </>
            )}
            {currentPeriod.status === 'valide' && (
              <button onClick={() => closePeriod(currentPeriod.id)} className="px-3 py-2 rounded-xl bg-zinc-800 text-white text-sm font-black inline-flex items-center gap-2">
                <Lock className="w-4 h-4" /> Clôturer
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : bulletins.length === 0 ? (
        <EmptyState title="Aucun bulletin" description="Ajoutez le premier bulletin pour cette période." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Employé</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Base</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Primes</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Retenues</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">CNSS</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">IR</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Net</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bulletins.map((b) => {
                const s = STATUS_BADGE[b.status] ?? { label: b.status, cls: 'bg-zinc-100 text-zinc-600' };
                return (
                  <tr key={b.id} className="border-b border-zinc-50">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{b.employee?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-700">{money(b.base_salary)}</td>
                    <td className="px-4 py-3 text-sm text-right text-emerald-600">{money(b.primes)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">{money(b.retenues)}</td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-600">{money(b.cnss_employee)}</td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-600">{money(b.ir)}</td>
                    <td className="px-4 py-3 text-sm text-right font-black text-zinc-900">{money(b.net_salary)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.cls}`}>{s.label}</span></td>
                    <td className="px-4 py-3 text-right">
                      {b.status !== 'valide' && (
                        <button onClick={() => validateBulletin(b.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">Valider</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showPeriod && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-black text-zinc-900">Nouvelle période de paie</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-bold text-zinc-700">Année
                <input type="number" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={pForm.year} onChange={(e) => setPForm({ ...pForm, year: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Mois
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={pForm.month} onChange={(e) => setPForm({ ...pForm, month: e.target.value })}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowPeriod(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={savePeriod} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
            </div>
          </div>
        </div>
      )}

      {showBulletin && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Nouveau bulletin</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Employé *
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={bForm.employee_id} onChange={(e) => {
                  const emp = employees.find((emp) => emp.id === Number(e.target.value));
                  setBForm({ ...bForm, employee_id: e.target.value, base_salary: emp?.salary ? String(emp.salary) : bForm.base_salary, net_salary: emp?.salary ? String(emp.salary) : bForm.net_salary });
                }}>
                  <option value="">— sélectionner —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Salaire base *
                <input type="number" step="0.01" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={bForm.base_salary} onChange={(e) => setBForm({ ...bForm, base_salary: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Primes
                <input type="number" step="0.01" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={bForm.primes} onChange={(e) => setBForm({ ...bForm, primes: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Indemnités
                <input type="number" step="0.01" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={bForm.indemnites} onChange={(e) => setBForm({ ...bForm, indemnites: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Retenues
                <input type="number" step="0.01" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={bForm.retenues} onChange={(e) => setBForm({ ...bForm, retenues: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Retenue absences
                <input type="number" step="0.01" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={bForm.absence_deduction} onChange={(e) => setBForm({ ...bForm, absence_deduction: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">CNSS
                <input type="number" step="0.01" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={bForm.cnss_employee} onChange={(e) => setBForm({ ...bForm, cnss_employee: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">IR
                <input type="number" step="0.01" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={bForm.ir} onChange={(e) => setBForm({ ...bForm, ir: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Net à payer *
                <input type="number" step="0.01" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-black" value={bForm.net_salary} onChange={(e) => setBForm({ ...bForm, net_salary: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowBulletin(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={saveBulletin} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
