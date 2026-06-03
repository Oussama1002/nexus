import React, { useId, useRef, useState, useCallback } from 'react';
import { Eye, EyeOff, Loader2, Upload, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { isImageAssetUrl, resolvePublicAssetUrl } from '../../../lib/publicAssetUrl';
import * as api from '../../../lib/api';

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

export function LogoUploadField({
  label,
  value,
  onChange,
  disabled,
  onUploaded,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onUploaded?: (logoUrl: string) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = resolvePublicAssetUrl(value);

  const uploadFile = async (file: File) => {
    setError(null);
    setUploading(true);
    const form = new FormData();
    form.append('logo', file);
    const res = await api.post<{ logoUrl: string }>('settings/center/upload/logo', form);
    setUploading(false);
    if (!res.ok || !res.data?.logoUrl) {
      setError(res.message);
      return;
    }
    onChange(res.data.logoUrl);
    onUploaded?.(res.data.logoUrl);
  };

  return (
    <div className="space-y-2 md:col-span-2">
      <label htmlFor={id} className="text-sm font-semibold text-zinc-800">
        {label}
      </label>
      <div className="flex flex-wrap items-start gap-4">
        {preview ? (
          <div className="shrink-0 rounded-xl border border-zinc-200 bg-white p-2">
            <img src={preview} alt="Logo" className="h-16 w-auto max-w-[200px] object-contain" />
          </div>
        ) : (
          <div className="h-20 w-28 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center text-xs font-bold text-zinc-400">
            Aucun logo
          </div>
        )}
        <div className="flex flex-col gap-2 min-w-[12rem]">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            disabled={disabled || uploading}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Envoi…' : value ? 'Remplacer le logo' : 'Choisir une image'}
          </button>
          {value && !disabled ? (
            <button
              type="button"
              className="text-xs font-bold text-rose-700 hover:underline text-left"
              onClick={() => onChange('')}
            >
              Retirer le logo
            </button>
          ) : null}
          <p className="text-xs text-zinc-500 font-medium">JPG, PNG, GIF, WebP ou SVG — max. 2 Mo</p>
          {error ? <p className="text-xs font-bold text-rose-700">{error}</p> : null}
        </div>
      </div>
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

export function TagListField({
  label,
  hint,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed)) {
      setInput('');
      return;
    }
    onChange([...value, trimmed]);
    setInput('');
  }, [input, value, onChange]);

  const remove = useCallback(
    (idx: number) => {
      onChange(value.filter((_, i) => i !== idx));
    },
    [value, onChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-3 items-baseline">
        <label htmlFor={id} className="text-sm font-semibold text-zinc-800">
          {label}
        </label>
        {hint && <span className="text-xs text-zinc-400 font-medium">{hint}</span>}
      </div>
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-200/90 bg-white min-h-[46px] transition-shadow focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent',
          disabled && 'opacity-50 cursor-not-allowed bg-zinc-50',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 border border-primary-200 text-xs font-bold text-primary-700"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(idx);
                }}
                className="hover:text-rose-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
              if (e.key === 'Backspace' && input === '' && value.length > 0) {
                remove(value.length - 1);
              }
            }}
            onBlur={() => {
              if (input.trim()) add();
            }}
            placeholder={value.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] bg-transparent text-sm font-medium text-zinc-900 placeholder:text-zinc-400 outline-none"
          />
        )}
      </div>
      {!disabled && (
        <p className="text-[11px] text-zinc-400 font-medium">Tapez puis appuyez sur Entrée pour ajouter.</p>
      )}
    </div>
  );
}
