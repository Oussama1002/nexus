/** Resolve stored path or relative /storage URL to a browser-loadable URL. */
export function resolvePublicAssetUrl(url: string): string {
  const s = url.trim();
  if (!s) return '';
  // Use the actual browser origin — storage files are served by the same server
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // Full URL with /storage/ path — extract path and rebuild with correct origin
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
