export type ActionContext = {
  userId?: string;
  view?: string;
};

export type ActionEvent = {
  name: string;
  ts: number;
  meta?: Record<string, unknown>;
};

type ActionHandler = (evt: ActionEvent, ctx: ActionContext) => void;

const REGISTRY = new Map<string, ActionHandler>();
const SUBSCRIBERS = new Map<string, Set<ActionHandler>>();

function now() {
  return Date.now();
}

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

export function registerAction(name: string, handler: ActionHandler) {
  REGISTRY.set(name, handler);
}

export function unregisterAction(name: string) {
  REGISTRY.delete(name);
}

export function subscribeAction(name: string, handler: ActionHandler) {
  const set = SUBSCRIBERS.get(name) ?? new Set<ActionHandler>();
  set.add(handler);
  SUBSCRIBERS.set(name, set);
  return () => {
    const current = SUBSCRIBERS.get(name);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) SUBSCRIBERS.delete(name);
  };
}

export function trackAction(evt: ActionEvent, ctx: ActionContext) {
  pushToLocalStorage('nexus.actions', { ...evt, ctx });
}

function closestActionEl(start: EventTarget | null): HTMLElement | null {
  if (!(start instanceof HTMLElement)) return null;
  return start.closest<HTMLElement>('[data-action],button,a,select,input,textarea');
}

function elementMeta(el: HTMLElement) {
  const base: Record<string, unknown> = {
    tag: el.tagName.toLowerCase(),
    id: el.id || undefined,
    name: (el as HTMLInputElement).name || undefined,
    type: (el as HTMLInputElement).type || undefined,
    value:
      el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement
        ? el.value
        : undefined,
    text: (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement) ? (el.textContent?.trim() || undefined) : undefined,
  };
  // Drop noisy undefined keys
  for (const k of Object.keys(base)) {
    if (base[k] === undefined) delete base[k];
  }
  return base;
}

export function initGlobalActions(getCtx: () => ActionContext, onUnhandled?: (evt: ActionEvent) => void) {
  const handler = (nativeEvt: Event) => {
    const el = closestActionEl(nativeEvt.target);
    if (!el) return;

    // Ignore disabled controls
    if ((el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.disabled) return;

    const actionName = el.getAttribute('data-action') || undefined;
    const ctx = getCtx();

    const evt: ActionEvent = {
      name: actionName ?? `ui.${el.tagName.toLowerCase()}.${nativeEvt.type}`,
      ts: now(),
      meta: {
        eventType: nativeEvt.type,
        ...elementMeta(el),
        dataAction: actionName,
      },
    };

    trackAction(evt, ctx);

    if (actionName) {
      const subs = SUBSCRIBERS.get(actionName);
      if (subs) {
        for (const sub of subs) sub(evt, ctx);
      }
      const fn = REGISTRY.get(actionName);
      if (fn) {
        fn(evt, ctx);
        return;
      }
      onUnhandled?.(evt);
      return;
    }

    // If no explicit action is declared, still record it but don’t spam the user.
  };

  // Capture phase so we see events even if React stops propagation.
  document.addEventListener('click', handler, true);
  document.addEventListener('change', handler, true);
  document.addEventListener('submit', handler, true);

  return () => {
    document.removeEventListener('click', handler, true);
    document.removeEventListener('change', handler, true);
    document.removeEventListener('submit', handler, true);
  };
}

