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
  reperee: 'Repérée',
  qualifiee: 'Qualifiée',
  contactee: 'Contactée',
  en_discussion: 'En discussion',
  en_negociation: 'En négociation',
  active: 'Active',
  inactive: 'Inactive',
  ecartee: 'Écartée',
  exclue: 'Exclue',
};

export const COLLAB_STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  en_attente_validation: 'En attente de validation',
  refusee: 'Refusée',
  en_preparation: 'En préparation',
  en_cours: 'En cours',
  en_revue: 'En revue',
  en_pause: 'En pause',
  contractualisation_en_attente: 'Contractualisation en attente',
  contractualisee: 'Contractualisée',
  terminee: 'Terminée',
  arretee: 'Arrêtée',
};

export const COLLAB_TYPE_LABELS: Record<string, string> = {
  story: 'Story',
  reel: 'Reel',
  post: 'Post',
  video: 'Vidéo',
  live: 'Live',
  carousel: 'Carousel',
  package: 'Package',
  ambassador: 'Ambassadeur',
};

export const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
  a_produire: 'À produire',
  en_cours: 'En cours',
  livre: 'Livré',
  valide: 'Validé',
  refuse: 'Refusé',
};

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  a_preparer: 'À préparer',
  expedie: 'Expédié',
  en_acheminement: 'En acheminement',
  recu: 'Reçu',
  non_parvenu: 'Non parvenu',
};

export const PAYMENT_NATURE_LABELS: Record<string, string> = {
  remuneration: 'Rémunération',
  bonus: 'Bonus',
  commission: 'Commission',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  en_attente_validation_n1: 'En attente validation N1',
  valide_n1: 'Validé N1',
  en_attente_validation_n2: 'En attente validation N2',
  valide_n2: 'Validé N2',
  paye: 'Payé',
  rejete: 'Rejeté',
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  contrat: 'Contrat',
  brief: 'Brief',
  facture: 'Facture',
  bon_commande: 'Bon de commande',
  piece_identite: 'Pièce d\'identité',
  rib: 'RIB',
  autre: 'Autre',
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
