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
