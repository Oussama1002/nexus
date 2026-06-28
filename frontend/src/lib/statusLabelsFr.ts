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

export const INFLUENCER_STATUS_LABELS: Record<string, string> = {
  lead: 'Lead',
  active: 'Actif',
  inactive: 'Inactif',
  blacklisted: 'Blacklisté',
};

export const COLLAB_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  negotiation: 'Négociation',
  approved: 'Approuvée',
  active: 'Active',
  completed: 'Terminée',
  cancelled: 'Annulée',
  disputed: 'Litige',
};

export const COLLAB_TYPE_LABELS: Record<string, string> = {
  story: 'Story',
  reel: 'Reel',
  post: 'Post',
  live: 'Live',
  package: 'Package',
  ambassador: 'Ambassadeur',
};

export const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  in_review: 'En cours',
  resolved: 'Résolue',
  reopened: 'Réouverte',
  closed: 'Fermée',
};

export const COMPLAINT_CATEGORY_LABELS: Record<string, string> = {
  delay: 'Retard',
  bad_content: 'Contenu inadéquat',
  contract: 'Contrat',
  payment: 'Paiement',
  quality: 'Qualité',
  other: 'Autre',
};

export const COMPLAINT_SEVERITY_LABELS: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  critical: 'Critique',
};

export function statusLabelFr(value: string | null | undefined, labels: Record<string, string>): string {
  if (!value) return '—';
  return labels[value] ?? value;
}
