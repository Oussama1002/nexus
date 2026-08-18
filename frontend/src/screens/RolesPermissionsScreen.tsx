import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { RolePermissionsPanel } from '../components/settings/RolePermissionsPanel';
import { useAuth } from '../context/AuthContext';

export function RolesPermissionsScreen() {
  const { hasPermission, isAdmin } = useAuth();
  const canViewRoles = hasPermission('roles.view') || isAdmin;
  const canListPermissions = hasPermission('permissions.list') || isAdmin;
  const canEditRoles = hasPermission('roles.update') || isAdmin;

  return (
    <div className="min-h-[calc(100vh-6rem)] pb-16">
      <PageHeader
        title="Rôles & permissions"
        subtitle="Gérez les rôles et configurez les permissions d'accès pour chaque profil utilisateur."
      />
      <div className="mt-8">
        <RolePermissionsPanel
          canViewRoles={canViewRoles}
          canListPermissions={canListPermissions}
          canEditRoles={canEditRoles}
        />
      </div>
    </div>
  );
}
