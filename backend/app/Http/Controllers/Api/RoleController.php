<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateRolePermissionsRequest;
use App\Models\Role;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class RoleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('roles.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');

        $q = Role::query()->withCount('users')->orderBy('name');
        if ($search) {
            $q->where(function ($qq) use ($search) {
                $s = '%'.$search.'%';
                $qq->where('name', 'like', $s)->orWhere('slug', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Roles retrieved successfully.');
    }

    public function show(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('roles.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $row = Role::query()->with(['permissions'])->findOrFail($id);

        return ApiResponse::success($row, 'Role retrieved successfully.');
    }

    public function update(UpdateRolePermissionsRequest $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('roles.update')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $role = Role::query()->findOrFail($id);

        if ($role->slug === 'admin') {
            return ApiResponse::error('Le rôle administrateur ne peut pas être modifié depuis l’interface.', null, 422);
        }

        $permissionIds = $request->validated()['permission_ids'];
        $role->permissions()->sync($permissionIds);

        return ApiResponse::success($role->load('permissions'), 'Permissions du rôle mises à jour.');
    }

    /**
     * Spec Phase 1 §7.3 — configure the landing view for a role.
     * PATCH /api/roles/{id}/landing-view with { landing_view: string|null }.
     */
    public function setLandingView(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('roles.update')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $data = $request->validate([
            'landing_view' => ['nullable', 'string', 'max:40'],
        ]);

        $role = Role::query()->findOrFail($id);
        $before = ['landing_view' => $role->landing_view];
        $role->landing_view = $data['landing_view'] ?: null;
        $role->save();

        \App\Services\AuditLogger::log($request, 'role.landing_view.update', $role, $before, [
            'landing_view' => $role->landing_view,
        ]);

        return ApiResponse::success($role->fresh(), 'Écran d’accueil du rôle mis à jour.');
    }
}
