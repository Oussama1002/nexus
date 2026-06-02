<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreStrategyRequest;
use App\Http\Requests\Api\UpdateStrategyRequest;
use App\Models\Strategy;
use App\Services\AuditLogger;
use App\Services\StrategyDocumentService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\UserRoleHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class StrategyController extends Controller
{
    public function __construct(
        protected StrategyDocumentService $documents,
    ) {}

    public function uploadDocument(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user?->hasPermissionSlug('strategies.create') && ! $user?->hasPermissionSlug('strategies.update')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $brandId = ApiBrandContext::resolveBrandId($request);

        $request->validate([
            'document' => ['required', 'file', 'max:10240', 'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,gif,webp'],
            'strategy_id' => ['nullable', 'integer'],
        ]);

        $strategyId = $request->filled('strategy_id') ? (int) $request->input('strategy_id') : null;
        if ($strategyId && ! Strategy::query()->where('brand_id', $brandId)->whereKey($strategyId)->exists()) {
            return ApiResponse::error('Stratégie introuvable.', null, 404);
        }

        try {
            $path = $this->documents->store($brandId, $request->file('document'), $strategyId);
        } catch (\InvalidArgumentException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        return ApiResponse::success(['document_path' => $path], 'Document enregistré.');
    }

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $status = $request->query('status');
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $assignedCm = $request->query('assigned_cm_id');
        $assignedCreator = $request->query('assigned_user_id');

        $q = Strategy::query()->with(['creator', 'brand', 'assignedCm:id,name,email', 'approvedByUser:id,name'])->where('brand_id', $brandId)->orderByDesc('id');
        if ($status) {
            $q->where('status', $status);
        }
        if ($from) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('created_at', '<=', $to);
        }
        if ($assignedCm) {
            $q->where('assigned_cm_id', (int) $assignedCm);
        } elseif ($assignedCreator) {
            $q->where('created_by', (int) $assignedCreator);
        }

        return ApiResponse::success($q->paginate($perPage), 'Strategies retrieved successfully.');
    }

    public function store(StoreStrategyRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();
        $data = $request->validated();
        $data['brand_id'] = $brandId;
        $data['created_by'] = $user?->id;
        $data['status'] = $data['status'] ?? 'draft';
        $data['version'] = $data['version'] ?? 1;

        if ($data['status'] === 'approved' && ! UserRoleHelper::canApproveStrategies($user)) {
            throw new AccessDeniedHttpException('Only SMM or Admin can create an approved strategy.');
        }

        $row = Strategy::query()->create($data);

        AuditLogger::log($request, 'strategies.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh(), 'Strategy created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Strategy::query()->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($row, 'Strategy retrieved successfully.');
    }

    public function update(UpdateStrategyRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Strategy::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $data = $request->validated();

        if (isset($data['status']) && $data['status'] === 'approved' && ! UserRoleHelper::canApproveStrategies($request->user())) {
            throw new AccessDeniedHttpException('Only SMM or Admin can approve a strategy.');
        }

        if (($data['status'] ?? null) === 'approved') {
            $data['approved_by'] = $request->user()?->id;
            $data['approved_at'] = now();
        }

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'strategies.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Strategy updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Strategy::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'strategies.delete', null, $before, null);

        return ApiResponse::success(null, 'Strategy deleted successfully.');
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        if (! UserRoleHelper::canApproveStrategies($request->user())) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Strategy::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->status = 'approved';
        $row->approved_by = $request->user()?->id;
        $row->approved_at = now();
        $row->save();

        AuditLogger::log($request, 'strategies.approve', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Strategy approved.');
    }

    public function uploadDocument(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('strategies.create')
            && ! $request->user()?->hasPermissionSlug('strategies.update')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $request->validate([
            'document' => [
                'required',
                'file',
                'max:10240',
                'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,gif,webp',
            ],
        ]);

        $file = $request->file('document');
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'pdf');
        $filename = 'strategy-'.now()->format('YmdHis').'-'.Str::lower(Str::random(8)).'.'.$ext;
        $path = $file->storeAs("strategy-documents/{$brandId}", $filename, 'public');
        $url = Storage::disk('public')->url($path);

        return ApiResponse::success(['document_path' => $url], 'Document téléversé.');
    }
}
