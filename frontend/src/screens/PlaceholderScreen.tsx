import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';

export function PlaceholderScreen({
  title,
  subtitle,
  cta,
}: {
  title: string;
  subtitle: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState
        title="Module en cours de finalisation"
        description="Cette section du CRM/ERP est prête pour implémentation. Nous pouvons maintenant brancher les vraies données et workflows."
        action={cta}
      />
    </div>
  );
}

