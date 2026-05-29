import React from 'react';
import { SocialContentWorkspace } from '../components/social/SocialContentWorkspace';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';

type BoundaryState = { error: Error | null };

class SocialWorkspaceErrorBoundary extends React.Component<
  { children: React.ReactNode },
  BoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Social workspace render error:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="space-y-6">
          <PageHeader title="Social & contenu" subtitle="Une erreur d’affichage s’est produite." />
          <EmptyState
            title="Impossible d’afficher le module"
            description={
              this.state.error.message ||
              'Erreur inattendue. Rechargez la page ou videz les filtres de date si vous les avez modifiés manuellement.'
            }
            action={
              <button
                type="button"
                onClick={() => this.setState({ error: null })}
                className="px-5 py-2.5 rounded-2xl bg-primary-600 text-white text-sm font-black"
              >
                Réessayer
              </button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export function SocialMediaWorkspaceScreen() {
  return (
    <SocialWorkspaceErrorBoundary>
      <SocialContentWorkspace />
    </SocialWorkspaceErrorBoundary>
  );
}
