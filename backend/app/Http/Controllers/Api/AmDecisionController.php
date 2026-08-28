<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmDecision;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AmDecisionController extends Controller
{
    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmDecision::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->with(['author:id,name'])
            ->orderByDesc('decided_at')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'brand_id' => 'required|integer|exists:brands,id',
            'subject' => 'required|string|max:255',
            'context' => 'nullable|string',
            'invoked_indicator' => 'nullable|string|max:100',
            'invoked_value' => 'nullable|string|max:100',
            'decision_taken' => 'required|string|min:5',
            'rejected_alternative' => 'nullable|string',
            'expected_consequence' => 'nullable|string',
            'linked_object_type' => 'nullable|string|max:30',
            'linked_object_id' => 'nullable|integer',
            'review_date' => 'nullable|date',
        ]);
        $row = AmDecision::query()->create(array_merge($data, [
            'decided_at' => now(),
            'author_user_id' => $request->user()->id,
        ]));
        AuditLogger::log($request, 'am_decision.recorded', $row, null, $row->toArray());
        return ApiResponse::success($row, 'Décision consignée.', 201);
    }

    public function reviewOutcome(Request $request, int $id)
    {
        $row = AmDecision::query()->findOrFail($id);
        $data = $request->validate(['reviewed_outcome' => 'required|string|min:3']);
        $before = $row->only(['reviewed_outcome']);
        $row->fill(['reviewed_outcome' => $data['reviewed_outcome']])->save();
        AuditLogger::log($request, 'am_decision.reviewed', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }
}
