<?php

namespace App\Support;

use App\Models\User;

class UserRoleHelper
{
    public static function loadRoles(User $user): void
    {
        $user->loadMissing('roles');
    }

    public static function hasRoleSlug(User $user, string $slug): bool
    {
        self::loadRoles($user);

        return $user->roles->contains(fn ($r) => $r->slug === $slug);
    }

    /** Admin or Manager Op — broad dashboard visibility without secrets. */
    public static function isAdmin(User $user): bool
    {
        return self::hasRoleSlug($user, 'admin');
    }

    public static function isSmm(User $user): bool
    {
        return self::hasRoleSlug($user, 'smm');
    }

    public static function isCommunityManager(User $user): bool
    {
        return self::hasRoleSlug($user, 'community_manager');
    }

    public static function isInfluenceManager(User $user): bool
    {
        return self::hasRoleSlug($user, 'influence_manager');
    }

    public static function isManagerOperationnel(User $user): bool
    {
        return self::hasRoleSlug($user, 'manager_operationnel');
    }

    public static function isConfirmatrice(User $user): bool
    {
        return self::hasRoleSlug($user, 'confirmatrice');
    }

    /** Vue globale (sans cloisonnement par assignation) : admin ou manager op. */
    public static function hasGlobalScope(User $user): bool
    {
        return self::isAdmin($user) || self::isManagerOperationnel($user);
    }

    /**
     * Rôle à périmètre fermé réseaux sociaux / influence / community (spec Revue
     * SMM §5 et Droits CM) : l'utilisateur n'a QUE des rôles sociaux. Sert à
     * masquer les données commerciales/financières hors de leur métier.
     */
    public static function isScopedSocialOnly(User $user): bool
    {
        self::loadRoles($user);
        $slugs = $user->roles->pluck('slug')->all();

        return $slugs !== [] && empty(array_diff($slugs, ['smm', 'influence_manager', 'community_manager']));
    }

    public static function canApproveStrategies(User $user): bool
    {
        return self::isAdmin($user) || self::isSmm($user);
    }

    public static function canApproveContentCalendar(User $user): bool
    {
        return self::isAdmin($user) || self::isSmm($user);
    }

    public static function canValidateProduction(User $user): bool
    {
        return self::isAdmin($user) || self::isSmm($user);
    }

    public static function canValidateCmDaily(User $user): bool
    {
        return self::isAdmin($user) || self::isSmm($user);
    }

    public static function canApproveCollaborations(User $user): bool
    {
        return self::isAdmin($user) || self::isSmm($user) || self::isInfluenceManager($user);
    }
}
