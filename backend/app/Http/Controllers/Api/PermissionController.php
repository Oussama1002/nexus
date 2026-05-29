<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class PermissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('permissions.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $perPage = min(max((int) $request->query('per_page', 50), 1), 500);
        $module = $request->query('module');
        $search = $request->query('search');

        $q = Permission::query()->orderBy('module')->orderBy('slug');
        if ($module) {
            $q->where('module', $module);
        }
        if ($search) {
            $s = '%'.$search.'%';
            $q->where(function ($qq) use ($s) {
                $qq->where('slug', 'like', $s)->orWhere('name', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Permissions retrieved successfully.');
    }

    public function show(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('permissions.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $row = Permission::query()->findOrFail($id);

        return ApiResponse::success($row, 'Permission retrieved successfully.');
    }
}
