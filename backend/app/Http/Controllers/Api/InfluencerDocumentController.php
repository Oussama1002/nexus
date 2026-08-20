<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InfluencerDocument;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InfluencerDocumentController extends Controller
{
    private const DOC_TYPES = ['contrat', 'brief', 'facture', 'bon_commande', 'piece_identite', 'rib', 'autre'];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = InfluencerDocument::query()->with(['uploadedByUser:id,name']);
        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        $q->orderByDesc('id');

        if ($influencerId = $request->query('influencer_id')) {
            $q->where('influencer_id', (int) $influencerId);
        }
        if ($collaborationId = $request->query('collaboration_id')) {
            $q->where('collaboration_id', (int) $collaborationId);
        }
        if ($docType = $request->query('document_type')) {
            $q->where('document_type', $docType);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'influencer_id' => ['required', 'integer', 'exists:influencers,id'],
            'collaboration_id' => ['nullable', 'integer', 'exists:influencer_collaborations,id'],
            'title' => ['required', 'string', 'max:255'],
            'document_type' => ['required', Rule::in(self::DOC_TYPES)],
            'file_url' => ['required', 'string', 'max:500'],
            'file_size' => ['nullable', 'integer'],
            'mime_type' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['brand_id'] = $brandId;
        $data['uploaded_by'] = $request->user()->id;

        $row = InfluencerDocument::query()->create($data);

        AuditLogger::log($request, 'influencer_documents.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load('uploadedByUser:id,name'), 'Document ajouté.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerDocument::query()
            ->with(['uploadedByUser:id,name', 'influencer:id,full_name', 'collaboration:id,title'])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerDocument::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'document_type' => ['nullable', Rule::in(self::DOC_TYPES)],
            'file_url' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'influencer_documents.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Document mis à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerDocument::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencer_documents.delete', null, $before, null);

        return ApiResponse::success(null, 'Document supprimé.');
    }
}
