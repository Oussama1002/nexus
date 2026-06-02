/** Resolve stored path or relative /storage URL to a browser-loadable URL. */
export function resolvePublicAssetUrl(url: string): string {
  const s = url.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) {
    const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
    const origin = (raw ?? 'http://127.0.0.1:8000/api').replace(/\/api\/?$/, '');
    return `${origin}${s}`;
  }
  return s;
}

export function isImageAssetUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(url);
}
