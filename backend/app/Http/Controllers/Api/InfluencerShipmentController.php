<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InfluencerShipment;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InfluencerShipmentController extends Controller
{
    private const STATUSES = ['a_preparer', 'expedie', 'en_acheminement', 'recu', 'non_parvenu'];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = InfluencerShipment::query()
            ->with(['collaboration:id,title', 'influencer:id,full_name,username', 'createdByUser:id,name']);
        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        $q->orderByDesc('id');

        if ($collaborationId = $request->query('collaboration_id')) {
            $q->where('collaboration_id', (int) $collaborationId);
        }
        if ($influencerId = $request->query('influencer_id')) {
            $q->where('influencer_id', (int) $influencerId);
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
            'collaboration_id' => ['required', 'integer', 'exists:influencer_collaborations,id'],
            'influencer_id' => ['required', 'integer', 'exists:influencers,id'],
            'products_json' => ['required', 'array'],
            'products_json.*.name' => ['required', 'string'],
            'products_json.*.quantity' => ['required', 'integer', 'min:1'],
            'shipping_company' => ['nullable', 'string', 'max:100'],
            'tracking_number' => ['nullable', 'string', 'max:100'],
            'tracking_url' => ['nullable', 'string', 'max:500'],
            'estimated_delivery' => ['nullable', 'date'],
            'delivery_address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
        ]);

        $data['brand_id'] = $brandId;
        $data['created_by'] = $request->user()->id;
        $data['status'] = $data['status'] ?? 'a_preparer';
        $data['reference'] = 'ENV-' . strtoupper(uniqid());
        $data['products_json'] = json_encode($data['products_json']);

        $row = InfluencerShipment::query()->create($data);

        AuditLogger::log($request, 'influencer_shipments.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['collaboration:id,title', 'influencer:id,full_name']), 'Envoi créé.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerShipment::query()
            ->with(['collaboration:id,title', 'influencer:id,full_name,username', 'createdByUser:id,name'])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerShipment::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'products_json' => ['nullable', 'array'],
            'shipping_company' => ['nullable', 'string', 'max:100'],
            'tracking_number' => ['nullable', 'string', 'max:100'],
            'tracking_url' => ['nullable', 'string', 'max:500'],
            'shipped_at' => ['nullable', 'date'],
            'estimated_delivery' => ['nullable', 'date'],
            'received_at' => ['nullable', 'date'],
            'delivery_address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
        ]);

        if (isset($data['products_json'])) {
            $data['products_json'] = json_encode($data['products_json']);
        }

        if (isset($data['status'])) {
            if ($data['status'] === 'expedie' && empty($row->shipped_at) && empty($data['shipped_at'])) {
                $data['shipped_at'] = now()->toDateString();
            }
            if ($data['status'] === 'recu' && empty($row->received_at) && empty($data['received_at'])) {
                $data['received_at'] = now()->toDateString();
            }
        }

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'influencer_shipments.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Envoi mis à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerShipment::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencer_shipments.delete', null, $before, null);

        return ApiResponse::success(null, 'Envoi supprimé.');
    }
}
