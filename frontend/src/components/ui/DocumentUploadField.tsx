import React, { useId, useRef, useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { isImageAssetUrl, resolvePublicAssetUrl } from '../../lib/publicAssetUrl';
import * as api from '../../lib/api';

export function DocumentUploadField({
  label,
  value,
  onChange,
  disabled,
  uploadPath,
  extraFormFields,
  accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*',
  hint = 'PDF, Office ou image — max. 10 Mo',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  uploadPath: string;
  extraFormFields?: Record<string, string>;
  accept?: string;
  hint?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = resolvePublicAssetUrl(value);
  const isImage = preview && isImageAssetUrl(preview);

  const uploadFile = async (file: File) => {
    setError(null);
    setUploading(true);
    const form = new FormData();
    form.append('document', file);
    if (extraFormFields) {
      for (const [k, v] of Object.entries(extraFormFields)) {
        if (v) form.append(k, v);
      }
    }
    const res = await api.post<{ document_path: string }>(uploadPath, form);
    setUploading(false);
    if (!res.ok || !res.data?.document_path) {
      setError(res.message);
      return;
    }
    onChange(res.data.document_path);
  };

  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-black uppercase text-zinc-400">{label}</span>
      <div className="flex flex-wrap items-start gap-4 mt-1">
        {preview ? (
          isImage ? (
            <div className="shrink-0 rounded-xl border border-zinc-200 bg-white p-2">
              <img src={preview} alt="" className="h-20 w-auto max-w-[180px] object-contain" />
            </div>
          ) : (
            <a
              href={preview}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-primary-700 hover:bg-primary-50"
            >
              <FileText className="w-4 h-4 shrink-0" />
              Voir le document
            </a>
          )
        ) : (
          <div className="h-16 w-28 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center text-[10px] font-bold text-zinc-400 text-center px-2">
            Aucun document
          </div>
        )}
        <div className="flex flex-col gap-2 min-w-[10rem]">
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
              'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-black text-zinc-800 hover:bg-zinc-50 disabled:opacity-50',
            )}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Envoi…' : value ? 'Remplacer' : 'Choisir un fichier'}
          </button>
          {value && !disabled ? (
            <button type="button" className="text-xs font-bold text-rose-700 hover:underline text-left" onClick={() => onChange('')}>
              Retirer
            </button>
          ) : null}
          <p className="text-[10px] text-zinc-500 font-medium">{hint}</p>
          {error ? <p className="text-[10px] font-bold text-rose-700">{error}</p> : null}
        </div>
      </div>
    </label>
  );
}
