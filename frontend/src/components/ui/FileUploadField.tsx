import React, { useId, useRef, useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fileNameFromUrl, isImageAssetUrl, resolvePublicAssetUrl } from '../../lib/publicAssetUrl';
import * as api from '../../lib/api';

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  uploadEndpoint: string;
  formFieldName: string;
  accept: string;
  hint?: string;
  onUploaded?: (path: string) => void;
};

export function FileUploadField({
  label,
  value,
  onChange,
  disabled,
  uploadEndpoint,
  formFieldName,
  accept,
  hint,
  onUploaded,
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = resolvePublicAssetUrl(value);
  const isImage = preview && isImageAssetUrl(preview);
  const fileName = fileNameFromUrl(value);

  const uploadFile = async (file: File) => {
    setError(null);
    setUploading(true);
    const form = new FormData();
    form.append(formFieldName, file);
    const res = await api.post<Record<string, string>>(uploadEndpoint, form);
    setUploading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const path =
      res.data?.document_path ??
      res.data?.logoUrl ??
      (typeof res.data === 'object' && res.data ? Object.values(res.data)[0] : '');
    if (!path || typeof path !== 'string') {
      setError('Réponse serveur invalide.');
      return;
    }
    onChange(path);
    onUploaded?.(path);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold text-zinc-800">
        {label}
      </label>
      <div className="flex flex-wrap items-start gap-4">
        {preview && isImage ? (
          <div className="shrink-0 rounded-xl border border-zinc-200 bg-white p-2">
            <img src={preview} alt="" className="h-16 w-auto max-w-[200px] object-contain" />
          </div>
        ) : preview ? (
          <a
            href={preview}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-primary-700 hover:bg-primary-50"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-[200px]">{fileName || 'Voir le document'}</span>
          </a>
        ) : (
          <div className="h-16 min-w-[8rem] rounded-xl border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center px-3 text-xs font-bold text-zinc-400 text-center">
            Aucun document
          </div>
        )}
        <div className="flex flex-col gap-2 min-w-[12rem]">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={accept}
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
            className={cn(
              'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50',
            )}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Envoi…' : value ? 'Remplacer' : 'Choisir un fichier'}
          </button>
          {value && !disabled ? (
            <button
              type="button"
              className="text-xs font-bold text-rose-700 hover:underline text-left"
              onClick={() => onChange('')}
            >
              Retirer le document
            </button>
          ) : null}
          {hint ? <p className="text-xs text-zinc-500 font-medium">{hint}</p> : null}
          {error ? <p className="text-xs font-bold text-rose-700">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
