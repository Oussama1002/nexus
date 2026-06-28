/** Libellés FR des rôles système (slug → affichage). */
export const ORGANIZATION_ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  manager_operationnel: 'Manager opérationnel',
  confirmatrice: 'Confirmatrice',
  media_buyer: 'Responsable media buying',
  stock_manager: 'Responsable stock',
  community_manager: 'Community manager',
  smm: 'Social media manager',
  influence_manager: 'Responsable influence',
  comptable: 'Comptable',
  client_brand_owner: 'Propriétaire de marque (client)',
};

export type OrganizationRoleOption = {
  slug: string;
  label: string;
};

export function organizationRoleLabel(
  slug: string | null | undefined,
  nameFromApi?: string | null,
): string {
  if (!slug?.trim()) return '—';
  if (nameFromApi?.trim()) return nameFromApi.trim();
  return ORGANIZATION_ROLE_LABELS[slug] ?? slug.replace(/_/g, ' ');
}

export function roleIdsFromEmployeeSlug(
  slug: string | null | undefined,
  roles: { id: number; slug: string }[],
): number[] {
  if (!slug?.trim()) return [];
  const role = roles.find((r) => r.slug === slug.trim());
  return role ? [role.id] : [];
}
