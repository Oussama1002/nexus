/** Flatten Laravel validation errors object into user-visible lines. */
export function flattenFieldErrors(errors: Record<string, unknown> | undefined): string[] {
  if (!errors || typeof errors !== 'object') return [];
  const out: string[] = [];
  for (const v of Object.values(errors)) {
    if (Array.isArray(v)) {
      out.push(...v.map((x) => String(x)));
    } else if (typeof v === 'string') {
      out.push(v);
    }
  }
  return out;
}
