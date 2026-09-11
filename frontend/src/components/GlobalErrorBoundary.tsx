import React from 'react';
import * as api from '../lib/api';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message: string };

/**
 * React error boundary that (a) shows a friendly fallback screen and
 * (b) POSTs the error + stack to /api/bugs-incidents/report-client so
 * the crash lands in the Bugs & incidents module automatically.
 *
 * Also installs a window.onerror + unhandledrejection listener so
 * async errors that never touch a React lifecycle are captured too.
 */
export class GlobalErrorBoundary extends React.Component<Props, State> {
  declare state: State;
  declare props: Readonly<Props>;
  declare setState: React.Component<Props, State>['setState'];

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Erreur inconnue' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Fire-and-forget report — don't await, don't await for user feedback.
    void reportClient({
      title: error.name || 'Erreur React',
      message: error.message,
      stack: (error.stack ?? '') + '\n\nComponent stack:\n' + (info.componentStack ?? ''),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      severity: 'major',
    });
  }

  componentDidMount() {
    // Async errors that never went through render/lifecycle.
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onWindowError);
    window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  onWindowError = (event: ErrorEvent) => {
    // Ignore ResizeObserver spam and cross-origin script errors that carry no message.
    const msg = event.message || '';
    if (!msg || /ResizeObserver loop/.test(msg)) return;
    void reportClient({
      title: 'window.onerror',
      message: msg,
      stack: (event.error?.stack as string | undefined) ?? '',
      url: window.location.href,
      severity: 'minor',
    });
  };

  onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason: any = event.reason;
    const message = typeof reason === 'string' ? reason : (reason?.message ?? String(reason));
    void reportClient({
      title: 'unhandledrejection',
      message,
      stack: reason?.stack ?? '',
      url: window.location.href,
      severity: 'minor',
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-4">
            <div className="text-5xl">🛠️</div>
            <h1 className="text-2xl font-black text-zinc-900">Un problème est survenu</h1>
            <p className="text-sm text-zinc-600">
              L'écran a rencontré une erreur. Elle a été signalée automatiquement.
            </p>
            <pre className="text-[10px] text-left bg-zinc-100 text-zinc-700 p-3 rounded-xl overflow-auto max-h-32">
              {this.state.message}
            </pre>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, message: '' })}
                className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-800 font-bold text-sm"
              >
                Réessayer
              </button>
              <button
                onClick={() => window.location.assign('/')}
                className="px-4 py-2 rounded-xl bg-primary-600 text-white font-black text-sm"
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type ClientReport = {
  title: string;
  message: string;
  stack?: string;
  url?: string;
  severity?: 'critical' | 'major' | 'minor' | 'cosmetic';
  context?: Record<string, unknown>;
};

function reportClient(payload: ClientReport): Promise<void> {
  // Deduplicate at source: don't fire the same error twice in the same second.
  const key = payload.title + '|' + payload.message.slice(0, 200);
  if (recent.has(key)) return Promise.resolve();
  recent.add(key);
  setTimeout(() => recent.delete(key), 5000);

  return api.post('bugs-incidents/report-client', payload, { brandId: false })
    .then(() => undefined)
    .catch(() => undefined); // never let reporting itself throw
}

const recent = new Set<string>();
