<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Brand;
use App\Models\Customer;
use App\Models\Supplier;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('audit_logs.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $userId = $request->query('user_id');
        $action = $request->query('action');
        $entityType = $request->query('entity_type');
        $entityId = $request->query('entity_id');
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = AuditLog::query()->with(['user'])->orderByDesc('created_at');
        if ($userId) {
            $q->where('user_id', (int) $userId);
        }
        if ($action) {
            $q->where('action', 'like', '%'.$action.'%');
        }
        if ($entityType) {
            $q->where('entity_type', $entityType);
        }
        if ($entityId !== null && $entityId !== '') {
            $q->where('entity_id', $entityId);
        }
        if ($from) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('created_at', '<=', $to);
        }

        return ApiResponse::success($q->paginate($perPage), 'Audit logs retrieved successfully.');
    }

    public function show(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('audit_logs.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $row = AuditLog::query()->with(['user'])->findOrFail($id);

        return ApiResponse::success($row, 'Audit log retrieved successfully.');
    }

    public function lookups(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('audit_logs.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        return ApiResponse::success([
            'users' => User::select('id', 'name')->orderBy('name')->get(),
            'brands' => Brand::select('id', 'name')->orderBy('name')->get(),
            'customers' => Customer::selectRaw('id, full_name as name')->orderBy('full_name')->get(),
            'suppliers' => Supplier::select('id', 'name')->orderBy('name')->get(),
        ]);
    }
}
