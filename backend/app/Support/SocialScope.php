<?php

namespace App\Support;

use App\Models\ContentCalendar;
use App\Models\ContentProduction;
use App\Models\User;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Row-level rules for Community Managers vs SMM/Admin in the Social module.
 */
class SocialScope
{
    public static function assertCmCalendarAccess(?User $user, ContentCalendar $row): void
    {
        if (! $user) {
            throw new AccessDeniedHttpException('Unauthenticated.');
        }
        if (UserRoleHelper::isAdmin($user) || UserRoleHelper::isSmm($user)) {
            return;
        }
        if (UserRoleHelper::isCommunityManager($user) && (int) $row->assigned_to !== (int) $user->id) {
            throw new AccessDeniedHttpException('Vous ne pouvez modifier que les contenus qui vous sont assignés.');
        }
    }

    public static function forceCmAssigneeOnCreate(?User $user, array &$data): void
    {
        if (! $user) {
            return;
        }
        if (UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user) && ! UserRoleHelper::isSmm($user)) {
            $data['assigned_to'] = $user->id;
        }
    }

    public static function assertCmProductionAccess(?User $user, ContentProduction $row): void
    {
        if (! $user) {
            throw new AccessDeniedHttpException('Unauthenticated.');
        }
        if (UserRoleHelper::isAdmin($user) || UserRoleHelper::isSmm($user)) {
            return;
        }
        if (UserRoleHelper::isCommunityManager($user) && (int) $row->owner_user_id !== (int) $user->id) {
            throw new AccessDeniedHttpException('Vous ne pouvez gérer que vos propres tâches de production.');
        }
    }

    public static function forceCmOwnerOnCreate(?User $user, array &$data): void
    {
        if (! $user) {
            return;
        }
        if (UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user) && ! UserRoleHelper::isSmm($user)) {
            $data['owner_user_id'] = $user->id;
        }
    }

    public static function stripCmCalendarAssignee(?User $user, array &$data): void
    {
        if ($user && UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user) && ! UserRoleHelper::isSmm($user)) {
            unset($data['assigned_to']);
        }
    }

    public static function stripCmProductionOwner(?User $user, array &$data): void
    {
        if ($user && UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user) && ! UserRoleHelper::isSmm($user)) {
            unset($data['owner_user_id']);
        }
    }
}
