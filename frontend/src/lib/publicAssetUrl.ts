/** Resolve stored path or relative /storage URL to a browser-loadable URL. */
export function resolvePublicAssetUrl(url: string): string {
  const s = url.trim();
  if (!s) return '';
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string) ?? '';
  const origin = apiBase ? apiBase.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? window.location.origin : '');
  if (/^https?:\/\//i.test(s)) {
    const storageIdx = s.indexOf('/storage/');
    if (storageIdx !== -1) {
      return `${origin}${s.substring(storageIdx)}`;
    }
    return s;
  }
  if (s.startsWith('/')) {
    return `${origin}${s}`;
  }
  return s;
}

export function isImageAssetUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(url);
}

export function fileNameFromUrl(url: string): string {
  const path = url.split('?')[0];
  return path.split('/').pop() ?? url;
}
