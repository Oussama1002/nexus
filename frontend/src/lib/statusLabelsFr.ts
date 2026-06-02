/** Libellés FR des statuts (valeur API → affichage). */

export const STRATEGY_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  review: 'En revue',
  approved: 'Approuvée',
  archived: 'Archivée',
};

export const CONTENT_CALENDAR_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  planned: 'Planifié',
  in_production: 'En production',
  review: 'En validation',
  approved: 'Approuvé',
  published: 'Publié',
  cancelled: 'Annulé',
};

export const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  submitted: 'Soumis',
  validated: 'Validé',
  rejected: 'Rejeté',
};

export const CM_TRACKING_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  submitted: 'Soumis',
  validated: 'Validé',
  rejected: 'Rejeté',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  approved: 'Validée',
  sent: 'Envoyée',
  paid: 'Payée',
  cancelled: 'Annulée',
};

export function statusLabelFr(value: string | null | undefined, labels: Record<string, string>): string {
  if (!value) return '—';
  return labels[value] ?? value;
}
