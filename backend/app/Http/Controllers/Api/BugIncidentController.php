<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BugIncident;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BugIncidentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $q = BugIncident::query()
            ->with(['reporter:id,name', 'assignee:id,name'])
            ->orderByDesc('id');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($severity = $request->query('severity')) $q->where('severity', $severity);
        if ($module = $request->query('module')) $q->where('module', $module);
        if ($search = $request->query('search')) {
            $q->where(function ($qq) use ($search) {
                $qq->where('title', 'like', "%{$search}%")->orWhere('description', 'like', "%{$search}%");
            });
        }

        $paginator = $q->paginate($perPage);
        $mapped = $paginator->getCollection()->map(fn ($r) => [
            'id' => $r->id,
            'title' => $r->title,
            'severity' => $r->severity,
            'module' => $r->module,
            'reporter' => $r->reporter?->name ?? '—',
            'assignee' => $r->assignee?->name,
            'status' => $r->status,
            'created_at' => $r->created_at?->toIso8601String(),
        ]);
        $paginator->setCollection($mapped);
        return ApiResponse::success($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'severity' => ['required', 'string', 'in:critical,major,minor,cosmetic'],
            'module' => ['required', 'string', 'max:30'],
            'assignee_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);
        $data['brand_id'] = $brandId;
        $data['reporter_user_id'] = $request->user()->id;
        $data['status'] = 'open';
        $row = BugIncident::query()->create($data);
        AuditLogger::log($request, 'bug.create', $row);
        return ApiResponse::success($row->fresh(), 'Bug enregistré.', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = BugIncident::query()->findOrFail($id);
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'severity' => ['nullable', 'string', 'in:critical,major,minor,cosmetic'],
            'module' => ['nullable', 'string', 'max:30'],
            'assignee_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'string', 'in:open,in_progress,resolved,closed'],
            'resolution' => ['nullable', 'string'],
        ]);
        if (!empty($data['status']) && in_array($data['status'], ['resolved', 'closed'], true) && !$row->resolved_at) {
            $data['resolved_at'] = now();
        }
        $row->fill($data)->save();
        AuditLogger::log($request, 'bug.update', $row);
        return ApiResponse::success($row->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = BugIncident::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();
        AuditLogger::log($request, 'bug.delete', null, $before, null);
        return ApiResponse::success(null, 'Bug supprimé.');
    }
}
