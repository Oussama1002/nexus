export type SessionEvent = {
  name: string;
  ts: number;
  meta?: Record<string, unknown>;
};

function safeJsonParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function pushToLocalStorage(key: string, value: unknown, max = 500) {
  const existing = safeJsonParse<unknown[]>(localStorage.getItem(key)) ?? [];
  const next = [...existing, value].slice(-max);
  localStorage.setItem(key, JSON.stringify(next));
}

export function trackSession(evt: SessionEvent) {
  pushToLocalStorage('nexus.sessions', evt);
}

