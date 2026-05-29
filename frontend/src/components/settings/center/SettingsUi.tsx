import React, { useId, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

const inputCls =
  'w-full px-4 py-3 rounded-xl border border-zinc-200/90 bg-white text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow';

export function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 bg-gradient-to-r from-zinc-50/90 to-white flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-zinc-900 tracking-tight">{title}</h3>
          {description && <p className="text-sm text-zinc-500 mt-1 font-medium">{description}</p>}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </section>
  );
}

export function ConnectionTestButton({
  label = 'Tester la connexion',
  onClick,
  disabled,
  loading,
}: {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-primary-200 bg-white text-xs font-bold uppercase tracking-wide text-primary-800 hover:bg-primary-50 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : null}
      {label}
    </button>
  );
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  disabled,
  multiline,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  multiline?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-3 items-baseline">
        <label htmlFor={id} className="text-sm font-semibold text-zinc-800">
          {label}
        </label>
        {hint && <span className="text-xs text-zinc-400 font-medium">{hint}</span>}
      </div>
      {multiline ? (
        <textarea
          id={id}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(inputCls, 'resize-y min-h-[96px]')}
        />
      ) : (
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputCls} />
      )}
    </div>
  );
}

export function SecretField({
  label,
  hint,
  value,
  onChange,
  disabled,
  configured,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  configured?: boolean;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  const ph =
    configured && !value ? 'Secret enregistré — saisissez une nouvelle valeur pour remplacer' : undefined;

  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-3 items-baseline">
        <label htmlFor={id} className="text-sm font-semibold text-zinc-800">
          {label}
        </label>
        {hint && <span className="text-xs text-zinc-400 font-medium">{hint}</span>}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={ph}
          autoComplete="new-password"
          className={cn(inputCls, 'pr-12')}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
          aria-label={show ? 'Masquer' : 'Afficher'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {configured && (
        <p className="text-xs font-medium text-emerald-700">Une valeur secrète est déjà enregistrée.</p>
      )}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex items-start gap-4 py-3 px-4 rounded-xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 transition-colors cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 rounded-md border-zinc-300 text-primary-600 focus:ring-primary-500"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-900">{label}</p>
        {description && <p className="text-xs text-zinc-500 mt-0.5 font-medium">{description}</p>}
      </div>
    </label>
  );
}
