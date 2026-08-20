<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrEvaluationCampaign;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrEvaluationCampaignController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = HrEvaluationCampaign::query()
            ->with(['createdBy:id,name'])
            ->withCount('evaluations')
            ->orderByDesc('year')
            ->orderByDesc('id');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        if ($year = $request->query('year')) {
            $q->where('year', (int) $year);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'year' => ['required', 'integer', 'min:2020', 'max:2099'],
            'period' => ['nullable', 'string', 'max:20'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['brand_id'] = $brandId;
        $data['status'] = 'brouillon';
        $data['created_by_user_id'] = $request->user()->id;

        $row = HrEvaluationCampaign::query()->create($data);

        AuditLogger::log($request, 'hr_evaluation_campaigns.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh(), 'Campagne créée.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = HrEvaluationCampaign::query()
            ->with(['createdBy:id,name', 'evaluations.employee:id,full_name,department'])
            ->withCount('evaluations')
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = HrEvaluationCampaign::query()->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'year' => ['nullable', 'integer', 'min:2020'],
            'period' => ['nullable', 'string', 'max:20'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'max:20'],
            'notes' => ['nullable', 'string'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'hr_evaluation_campaigns.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Campagne mise à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = HrEvaluationCampaign::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'hr_evaluation_campaigns.delete', null, $before, null);

        return ApiResponse::success(null, 'Campagne supprimée.');
    }

    public function launch(Request $request, string $id): JsonResponse
    {
        $row = HrEvaluationCampaign::query()->findOrFail($id);

        if ($row->status !== 'brouillon') {
            return ApiResponse::error('Seules les campagnes en brouillon peuvent être lancées.', null, 422);
        }

        $before = $row->toArray();
        $row->status = 'en_cours';
        $row->save();

        AuditLogger::log($request, 'hr_evaluation_campaigns.launch', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Campagne lancée.');
    }
}
