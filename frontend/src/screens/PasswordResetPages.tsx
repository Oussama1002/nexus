import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '../lib/api';

const inputCls =
  'w-full px-5 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:border-primary-500 outline-none transition-all text-sm font-medium';
const buttonCls =
  'w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 transition-all text-sm uppercase tracking-wider';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-6">
      <div className="max-w-md w-full">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Layers className="text-white w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white">Brandna</span>
            <span className="text-xl font-light tracking-tight text-zinc-500 ml-1">CRM</span>
          </div>
        </div>
        <h1 className="text-3xl font-black text-white mb-3">{title}</h1>
        <p className="text-zinc-500 text-sm font-medium mb-8">{subtitle}</p>
        {children}
        <Link to="/login" className="mt-8 inline-block text-sm font-bold text-zinc-400 hover:text-white">
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  const cls = tone === 'success'
    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    : 'bg-rose-500/10 border-rose-500/20 text-rose-400';
  return <div className={`rounded-2xl border px-5 py-4 text-sm font-medium ${cls}`}>{children}</div>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await api.post('auth/forgot-password', { email: email.trim() }, { brandId: false });
    setSubmitting(false);
    setResult({ ok: res.ok, message: res.message });
  }

  return (
    <Shell title="Mot de passe oublié" subtitle="Saisissez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.">
      {result?.ok ? (
        <Notice tone="success">{result.message}</Notice>
      ) : (
        <form className="space-y-5" onSubmit={onSubmit}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="email@exemple.com"
            required
          />
          {result && !result.ok && <Notice tone="error">{result.message}</Notice>}
          <button type="submit" disabled={submitting} className={buttonCls}>
            {submitting ? 'Envoi…' : 'Envoyer le lien'}
          </button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setResult({ ok: false, message: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }
    setSubmitting(true);
    const res = await api.post(
      'auth/reset-password',
      { email, token, password, password_confirmation: confirm },
      { brandId: false },
    );
    setSubmitting(false);
    setResult({ ok: res.ok, message: res.message });
  }

  if (!token || !email) {
    return (
      <Shell title="Lien invalide" subtitle="Ce lien de réinitialisation est incomplet.">
        <Link to="/forgot-password" className="text-sm font-bold text-primary-400 hover:text-primary-300">
          Refaire une demande →
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title="Nouveau mot de passe" subtitle={`Compte : ${email}`}>
      {result?.ok ? (
        <div className="space-y-5">
          <Notice tone="success">{result.message}</Notice>
          <Link to="/login" className={`${buttonCls} block text-center`}>Se connecter</Link>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={onSubmit}>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="Nouveau mot de passe (8 caractères min.)"
            minLength={8}
            required
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
            placeholder="Confirmer le mot de passe"
            minLength={8}
            required
          />
          {result && !result.ok && (
            <Notice tone="error">
              {result.message}{' '}
              <Link to="/forgot-password" className="underline">Nouvelle demande</Link>
            </Notice>
          )}
          <button type="submit" disabled={submitting} className={buttonCls}>
            {submitting ? 'Enregistrement…' : 'Changer le mot de passe'}
          </button>
        </form>
      )}
    </Shell>
  );
}
