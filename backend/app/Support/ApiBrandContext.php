<?php

namespace App\Support;

use App\Models\Brand;
use App\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ApiBrandContext
{
    /**
     * Resolve active brand for scoped resources.
     * Admin / manager_operationnel may access any existing brand when X-Brand-Id is set.
     * Other users must own the brand via brand_users.
     *
     * @return int|null null means "no filter" (admin index all brands — rarely used)
     */
    public static function resolveBrandId(Request $request, bool $required = true): ?int
    {
        $user = $request->user();
        if (! $user) {
            throw new AccessDeniedHttpException('Unauthenticated.');
        }

        $user->loadMissing(['roles', 'brands']);

        $isAdmin = $user->roles->contains(fn ($r) => $r->slug === 'admin');
        $isManager = $user->roles->contains(fn ($r) => $r->slug === 'manager_operationnel');
        $privileged = $isAdmin || $isManager;

        $raw = $request->header('X-Brand-Id') ?? $request->query('brand_id');
        $ownedIds = $user->brands->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        if (($raw === 'all' || $raw === null || $raw === '') && ! $required && $privileged) {
            return null;
        }

        if ($raw === null || $raw === '' || $raw === 'all') {
            if (! $required && count($ownedIds) >= 1) {
                return $ownedIds[0];
            }
            if (count($ownedIds) === 1) {
                return $ownedIds[0];
            }
            throw new HttpException(422, 'Active brand is required (X-Brand-Id header or brand_id query parameter).');
        }

        $id = (int) $raw;

        if ($privileged) {
            if (! Brand::query()->whereKey($id)->exists()) {
                throw new HttpException(422, 'Invalid brand id.');
            }

            return $id;
        }

        if (! in_array($id, $ownedIds, true)) {
            throw new AccessDeniedHttpException('You do not have access to this brand.');
        }

        return $id;
    }

    /**
     * Apply brand filter to a query builder — skips the filter when brandId is null (admin "all brands" mode).
     */
    public static function scopeBrand(\Illuminate\Database\Eloquent\Builder $query, ?int $brandId, string $column = 'brand_id'): \Illuminate\Database\Eloquent\Builder
    {
        if ($brandId !== null) {
            $query->where($column, $brandId);
        }

        return $query;
    }

    public static function assertUserOwnsBrand(User $user, int $brandId): void
    {
        $user->loadMissing(['roles', 'brands']);
        $privileged = $user->roles->contains(fn ($r) => in_array($r->slug, ['admin', 'manager_operationnel'], true));
        if ($privileged) {
            return;
        }
        if (! $user->brands->contains('id', $brandId)) {
            throw new AccessDeniedHttpException('You do not have access to this brand.');
        }
    }
}
