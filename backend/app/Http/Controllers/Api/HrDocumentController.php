<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrDocument;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrDocumentController extends Controller
{
    private const DOC_TYPES = [
        'contrat', 'avenant', 'attestation', 'cin', 'cnss', 'rib', 'diplome', 'autre',
    ];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = HrDocument::query()
            ->with(['employee:id,full_name,department', 'uploadedBy:id,name'])
            ->orderByDesc('id');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        if ($employeeId = $request->query('employee_id')) {
            $q->where('employee_id', (int) $employeeId);
        }
        if ($type = $request->query('document_type')) {
            $q->where('document_type', $type);
        }
        if ($request->boolean('expiring_soon')) {
            $q->whereNotNull('expiry_date')
                ->whereBetween('expiry_date', [now()->toDateString(), now()->addDays(60)->toDateString()]);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'title' => ['required', 'string', 'max:255'],
            'document_type' => ['required', 'string', 'in:' . implode(',', self::DOC_TYPES)],
            'file_url' => ['required', 'string', 'max:500'],
            'file_size' => ['nullable', 'integer'],
            'mime_type' => ['nullable', 'string', 'max:100'],
            'expiry_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['brand_id'] = $brandId;
        $data['uploaded_by_user_id'] = $request->user()->id;

        $row = HrDocument::query()->create($data);

        AuditLogger::log($request, 'hr_documents.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load('uploadedBy:id,name'), 'Document ajouté.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = HrDocument::query()
            ->with(['employee:id,full_name,department', 'uploadedBy:id,name'])
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = HrDocument::query()->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'document_type' => ['nullable', 'string', 'in:' . implode(',', self::DOC_TYPES)],
            'file_url' => ['nullable', 'string', 'max:500'],
            'expiry_date' => ['nullable', 'date'],
            'is_signed' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ]);

        if (isset($data['is_signed']) && $data['is_signed'] && ! $row->is_signed) {
            $data['signed_at'] = now();
        }

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'hr_documents.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Document mis à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = HrDocument::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'hr_documents.delete', null, $before, null);

        return ApiResponse::success(null, 'Document supprimé.');
    }
}
