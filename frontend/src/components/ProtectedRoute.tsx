import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, checkPermissionSlug } from '../context/AuthContext';

export function ProtectedRoute({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission?: string | string[];
}) {
  const { isAuthenticated, loading, isAdmin, permissionSlugs } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-zinc-600">Chargement…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !checkPermissionSlug(permissionSlugs, isAdmin, permission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
        <div className="max-w-md w-full card p-8 text-center space-y-4">
          <p className="text-lg font-black text-zinc-900">Accès refusé</p>
          <p className="text-sm text-zinc-600">
            Vous n’avez pas la permission requise pour afficher cette page.
          </p>
          {permission && (
            <p className="text-xs font-mono text-zinc-500 bg-zinc-100 rounded-lg px-3 py-2">
              {Array.isArray(permission) ? permission.join(' · ') : permission}
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
