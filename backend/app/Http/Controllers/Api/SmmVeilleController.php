<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmVeilleNote;
use App\Models\SmmVeilleTrend;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmVeilleController extends Controller
{
    public function indexNotes(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $q = SmmVeilleNote::query()
            ->with(['author:id,name', 'trends'])
            ->orderByDesc('week_start_date');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($week = $request->query('week')) $q->where('week_start_date', $week);
        return ApiResponse::success($q->paginate((int) $request->query('per_page', 25)));
    }

    public function storeNote(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'week_start_date' => ['required', 'date'],
            'platforms_observed_json' => ['nullable', 'array'],
            'platform_behavior_changes' => ['nullable', 'string'],
        ]);
        $data['brand_id'] = $brandId;
        $data['author_user_id'] = $request->user()->id;
        $row = SmmVeilleNote::query()->create($data);
        AuditLogger::log($request, 'smm_veille_note.create', $row);
        return ApiResponse::success($row, 'Note créée.', 201);
    }

    public function showNote(Request $request, string $id): JsonResponse
    {
        $row = SmmVeilleNote::query()->with(['author:id,name', 'trends.generatedContent:id,title'])->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function updateNote(Request $request, string $id): JsonResponse
    {
        $row = SmmVeilleNote::query()->findOrFail($id);
        $data = $request->validate([
            'platforms_observed_json' => ['nullable', 'array'],
            'platform_behavior_changes' => ['nullable', 'string'],
        ]);
        $before = $row->toArray();
        $row->fill($data)->save();
        AuditLogger::log($request, 'smm_veille_note.update', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }

    public function storeTrend(Request $request, string $noteId): JsonResponse
    {
        $note = SmmVeilleNote::query()->findOrFail($noteId);
        $data = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'platform' => ['required', 'string', 'max:40'],
            'decision' => ['required', 'string', 'in:retenue,ecartee'],
            'reason' => ['required', 'string'],
            'filter_brand_relevance' => ['nullable', 'boolean'],
            'filter_audience_relevance' => ['nullable', 'boolean'],
            'filter_positioning_coherence' => ['nullable', 'boolean'],
            'filter_execution_effort_ok' => ['nullable', 'boolean'],
        ]);
        // If retenue: all 4 filters must be true
        if ($data['decision'] === 'retenue') {
            foreach (['filter_brand_relevance', 'filter_audience_relevance', 'filter_positioning_coherence', 'filter_execution_effort_ok'] as $f) {
                if (empty($data[$f])) return ApiResponse::error("Les 4 filtres de pertinence sont obligatoires pour une tendance retenue.", null, 422);
            }
        }
        $data['veille_note_id'] = $note->id;
        $data['brand_id'] = $note->brand_id;
        $t = SmmVeilleTrend::query()->create($data);
        AuditLogger::log($request, 'smm_trend.create', $t);
        return ApiResponse::success($t, 'Tendance enregistrée.', 201);
    }

    public function updateTrend(Request $request, string $noteId, string $trendId): JsonResponse
    {
        $t = SmmVeilleTrend::query()->where('veille_note_id', $noteId)->findOrFail($trendId);
        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:255'],
            'decision' => ['nullable', 'string', 'in:retenue,ecartee'],
            'reason' => ['nullable', 'string'],
            'generated_content_id' => ['nullable', 'integer', 'exists:smm_contents,id'],
        ]);
        // Guard: écartée requires a motif (also enforced at store).
        if (($data['decision'] ?? $t->decision) === 'ecartee' && empty($data['reason'] ?? $t->reason)) {
            return ApiResponse::error('Motif obligatoire pour toute tendance écartée.', null, 422);
        }
        $before = $t->toArray();
        $t->fill($data)->save();
        AuditLogger::log($request, 'smm_trend.update', $t, $before, $t->fresh()->toArray());
        return ApiResponse::success($t->fresh());
    }
}
