<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmEvent;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmEventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $q = SmmEvent::query()->with(['createdBy:id,name', 'validatedBy:id,name'])->withCount('contents')->orderByDesc('start_date');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($type = $request->query('event_type')) $q->where('event_type', $type);
        return ApiResponse::success($q->paginate((int) $request->query('per_page', 25)));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'event_type' => ['required', 'string', 'in:previsible,temps_reel'],
            'amplitude' => ['nullable', 'string', 'max:30'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date'],
            'anticipation_days' => ['nullable', 'integer'],
            'commercial_offers' => ['nullable', 'string'],
            'coordinated_departments_json' => ['nullable', 'array'],
            'milestones_json' => ['nullable', 'array'],
            'cm_instructions' => ['nullable', 'string'],
            'has_commercial_offer' => ['nullable', 'boolean'],
        ]);
        $data['brand_id'] = $brandId;
        $data['created_by_user_id'] = $request->user()->id;
        $data['status'] = 'planifie';
        $row = SmmEvent::query()->create($data);
        AuditLogger::log($request, 'smm_event.create', $row);
        return ApiResponse::success($row, 'Événement créé.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = SmmEvent::query()->with(['createdBy:id,name', 'validatedBy:id,name', 'directionValidatedBy:id,name', 'contents:id,title,status,scheduled_publish_at,event_id'])->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = SmmEvent::query()->findOrFail($id);
        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:255'],
            'amplitude' => ['nullable', 'string', 'max:30'],
            'anticipation_days' => ['nullable', 'integer'],
            'commercial_offers' => ['nullable', 'string'],
            'coordinated_departments_json' => ['nullable', 'array'],
            'milestones_json' => ['nullable', 'array'],
            'cm_instructions' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:planifie,retroplanning_a_valider,en_preparation,en_cours,termine,annule'],
            'has_commercial_offer' => ['nullable', 'boolean'],
        ]);
        $row->fill($data)->save();
        return ApiResponse::success($row->fresh());
    }

    public function submitRetroplanning(Request $request, string $id): JsonResponse
    {
        $row = SmmEvent::query()->findOrFail($id);
        $row->status = 'retroplanning_a_valider';
        $row->save();
        AuditLogger::log($request, 'smm_event.submit_retro', $row);
        return ApiResponse::success($row->fresh());
    }

    public function validateRetroplanning(Request $request, string $id): JsonResponse
    {
        $row = SmmEvent::query()->findOrFail($id);
        if ($row->status !== 'retroplanning_a_valider') return ApiResponse::error('Non validable.', null, 422);
        if ($row->created_by_user_id === $request->user()->id) return ApiResponse::error('Auteur ≠ validateur.', null, 422);
        $row->status = 'en_preparation';
        $row->validated_by_user_id = $request->user()->id;
        $row->validated_at = now();
        $row->save();
        AuditLogger::log($request, 'smm_event.validate_retro', $row);
        return ApiResponse::success($row->fresh(), 'Rétroplanning validé.');
    }

    public function validateCommercialOffer(Request $request, string $id): JsonResponse
    {
        $row = SmmEvent::query()->findOrFail($id);
        if (!$row->has_commercial_offer) return ApiResponse::error('Pas d\'offre commerciale à valider.', null, 422);
        $row->direction_validated_by_user_id = $request->user()->id;
        $row->direction_validated_at = now();
        $row->save();
        AuditLogger::log($request, 'smm_event.validate_offer', $row);
        return ApiResponse::success($row->fresh(), 'Offre commerciale validée par la Direction.');
    }
}
