import React, { useEffect, useState } from 'react';
import { Loader2, Save, User } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';

export function ProfileScreen() {
  const { user, roles, fetchMe } = useAuth();
  const { brands, activeBrand } = useBrand();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone ?? '');
    }
  }, [user]);

  async function saveProfile() {
    setSaving(true);
    const res = await api.put('profile', { name: name.trim(), phone: phone.trim() || null });
    setSaving(false);
    if (res.ok) {
      toast.success('Profil mis à jour.');
      await fetchMe();
    } else {
      toast.error(res.message);
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) {
      toast.error('Remplissez tous les champs du mot de passe.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    setSavingPw(true);
    const res = await api.put('profile/password', {
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: confirmPassword,
    });
    setSavingPw(false);
    if (res.ok) {
      toast.success('Mot de passe modifié.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast.error(res.message);
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader title="Mon profil" subtitle="Gérez vos informations personnelles et votre mot de passe." />

      <div className="card p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 text-primary-800 font-black text-xl flex items-center justify-center ring-2 ring-white shadow-md">
            {(user?.name || '?').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-black text-zinc-900">{user?.name}</p>
            <p className="text-sm font-medium text-zinc-500">{user?.email}</p>
            <div className="flex gap-2 mt-1">
              {roles.map((r) => (
                <span key={r.id} className="px-2 py-0.5 rounded-lg bg-primary-50 text-primary-700 text-[11px] font-bold uppercase">
                  {r.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Informations personnelles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Nom complet</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-zinc-500 mb-1">E-mail</label>
            <input value={email} disabled className={`${inputCls} bg-zinc-50 text-zinc-400 cursor-not-allowed`} />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Téléphone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+212…" />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Marque active</label>
            <input value={activeBrand.name} disabled className={`${inputCls} bg-zinc-50 text-zinc-400 cursor-not-allowed`} />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold inline-flex items-center gap-2 shadow-md shadow-primary-900/10 hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Changer le mot de passe</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Mot de passe actuel</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Nouveau mot de passe</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Confirmer</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void changePassword()}
            disabled={savingPw}
            className="px-5 py-2.5 rounded-xl bg-zinc-800 text-white text-sm font-bold inline-flex items-center gap-2 shadow-md hover:bg-zinc-900 disabled:opacity-50"
          >
            {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Modifier le mot de passe
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Marques accessibles</h2>
        <div className="flex flex-wrap gap-2">
          {brands.map((b) => (
            <div key={b.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50/50">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] text-white font-bold" style={{ backgroundColor: b.color }}>
                {b.logo}
              </div>
              <span className="text-sm font-bold text-zinc-700">{b.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
