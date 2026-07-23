import React, { useState } from 'react';
import { Layers, ArrowRight, Shield, BarChart3, Users, Package } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function LoginPage() {
  const { login, isAuthenticated, loading, roleSlugs } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  if (!loading && isAuthenticated) {
    const dest = roleSlugs.includes('confirmatrice') ? '/whatsapp' : '/dashboard';
    return <Navigate to={dest} replace />;
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
    if (res.attendance?.was_late) {
      toast.error(`Retard de ${res.attendance.minutes_late} min — pointage a ${res.attendance.clock_in_at}`);
    } else if (res.attendance) {
      toast.success(`Pointage enregistre a ${res.attendance.clock_in_at}`);
    }
    const dest = res.roleSlugs?.includes('confirmatrice') ? '/whatsapp' : '/dashboard';
    navigate(dest, { replace: true });
  }

  const features = [
    { icon: <BarChart3 className="w-5 h-5" />, title: 'Analytics', desc: 'Tableaux de bord en temps reel' },
    { icon: <Package className="w-5 h-5" />, title: 'Commandes', desc: 'Gestion complete du cycle de vente' },
    { icon: <Users className="w-5 h-5" />, title: 'Equipes', desc: 'Suivi RH et performance' },
    { icon: <Shield className="w-5 h-5" />, title: 'Securite', desc: 'Roles et permissions granulaires' },
  ];

  return (
    <div className="min-h-screen flex items-stretch bg-zinc-950">
      {/* Left — Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 relative z-10 w-full lg:w-[45%]">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Layers className="text-white w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white">Nexus</span>
              <span className="text-xl font-light tracking-tight text-zinc-500 ml-1">CRM</span>
            </div>
          </div>

          {/* Header */}
          <div className="mb-10">
            <h1 className="text-4xl font-black text-white mb-3 leading-tight">
              Bon retour<span className="text-primary-500">.</span>
            </h1>
            <p className="text-zinc-500 text-base font-medium">
              Connectez-vous pour acceder a votre espace de gestion.
            </p>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Email</label>
              <div className={`relative rounded-2xl transition-all duration-200 ${focused === 'email' ? 'ring-2 ring-primary-500/50' : ''}`}>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  className="w-full px-5 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:border-primary-500 outline-none transition-all text-sm font-medium"
                  placeholder="email@exemple.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Mot de passe</label>
              <div className={`relative rounded-2xl transition-all duration-200 ${focused === 'password' ? 'ring-2 ring-primary-500/50' : ''}`}>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  className="w-full px-5 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:border-primary-500 outline-none transition-all text-sm font-medium"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 px-5 py-4 text-sm text-rose-400 font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 transition-all flex items-center justify-center gap-3 mt-2 text-sm uppercase tracking-wider group"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-16 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <p className="text-zinc-600 text-xs font-medium uppercase tracking-wider">
              Nexus Omni CRM
            </p>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>
        </div>
      </div>

      {/* Right — Feature panel */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 via-zinc-900 to-zinc-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent" />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        {/* Content */}
        <div className="relative flex flex-col justify-center px-16 xl:px-24 w-full">
          <div className="max-w-lg">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-bold uppercase tracking-wider mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
              Plateforme securisee
            </div>

            <h2 className="text-5xl font-black text-white leading-tight mb-6">
              Tout piloter<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">depuis un seul endroit.</span>
            </h2>

            <p className="text-zinc-400 text-lg leading-relaxed mb-12">
              Commandes, livraison, marketing, stocks et equipes — centralises dans une interface unique.
            </p>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((f) => (
                <div key={f.title} className="group p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-primary-500/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400 mb-3 group-hover:bg-primary-500/20 transition-colors">
                    {f.icon}
                  </div>
                  <p className="text-white font-bold text-sm mb-1">{f.title}</p>
                  <p className="text-zinc-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Decorative blurs */}
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-primary-500/5 rounded-full blur-[120px]" />
        <div className="absolute -top-32 right-32 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
