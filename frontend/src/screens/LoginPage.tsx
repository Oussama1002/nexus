import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-stretch">
      <div className="flex-1 flex flex-col justify-center px-12 md:px-24 bg-white relative z-10 w-full lg:w-1/2">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Layers className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-zinc-900">Nexus CRM</span>
          </div>

          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Bon retour.</h1>
          <p className="text-zinc-500 mb-8 font-medium">Connectez-vous à votre espace de gestion.</p>

          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-zinc-400"
                placeholder="email@exemple.com"
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-zinc-700">Mot de passe</label>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-800 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-200 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {submitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-zinc-100">
            <p className="text-zinc-500 text-sm">
              Nexus Omni CRM — Gestion centralisée de votre activité.
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:block lg:flex-1 relative bg-primary-600 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 opacity-90" />
        <div className="absolute inset-0 flex items-center justify-center px-12">
          <div className="max-w-lg text-white space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-medium tracking-wide uppercase">
              Plateforme sécurisée
            </div>
            <h2 className="text-5xl font-bold leading-tight">Votre CRM tout‑en‑un.</h2>
            <p className="text-primary-100 text-lg leading-relaxed font-light">
              Gérez vos commandes, stocks, marketing et équipes depuis un seul espace.
            </p>
          </div>
        </div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
