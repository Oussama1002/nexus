<?php

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * @param  \Illuminate\Support\Collection<int, string>  $slugs
     */
    protected function userHasPermission($slugs, string $required): bool
    {
        if ($slugs->contains($required)) {
            return true;
        }

        if (! str_contains($required, '.')) {
            return false;
        }

        [$module] = explode('.', $required, 2);

        return $slugs->contains($module.'.*');
    }

    /**
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (! $user) {
            return ApiResponse::error('Unauthenticated.', null, 401);
        }

        $user->loadMissing(['roles.permissions']);

        // Align with User::hasPermissionSlug(): admins may access any route without explicit pivot rows.
        if ($user->isAdmin()) {
            return $next($request);
        }

        $slugs = $user->roles
            ->flatMap(fn ($role) => $role->permissions)
            ->pluck('slug')
            ->unique()
            ->values();

        $required = count($permissions) === 1 ? explode('|', $permissions[0]) : $permissions;

        foreach ($required as $permission) {
            if ($this->userHasPermission($slugs, $permission)) {
                return $next($request);
            }
        }

        return ApiResponse::error('You do not have permission to perform this action.', null, 403);
    }
}
