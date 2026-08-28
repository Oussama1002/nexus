<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmRoadmap;
use App\Services\Am\AmRoadmapService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use RuntimeException;

class AmRoadmapController extends Controller
{
    public function __construct(private readonly AmRoadmapService $svc) {}

    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmRoadmap::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->with(['template:id,label', 'accountManager:id,name'])
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function show(Request $request, int $id)
    {
        $row = AmRoadmap::query()->with([
            'template', 'accountManager:id,name',
            'chantiers.template',
            'gates.template', 'gates.criteria.template',
        ])->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function store(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'template_id' => 'required|integer|exists:am_roadmap_templates,id',
            'account_manager_user_id' => 'nullable|integer|exists:users,id',
        ]);
        try {
            $roadmap = $this->svc->open($brandId, (int) $data['template_id'], $data['account_manager_user_id'] ?? null, $request->user(), $request);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
        return ApiResponse::success($roadmap, 'Feuille de route ouverte.', 201);
    }

    public function close(Request $request, int $id)
    {
        $row = AmRoadmap::query()->findOrFail($id);
        $data = $request->validate(['summary' => 'required|string|min:5']);
        try {
            $row = $this->svc->close($row, $data['summary'], $request->user(), $request);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
        return ApiResponse::success($row);
    }

    public function suspend(Request $request, int $id)
    {
        $row = AmRoadmap::query()->findOrFail($id);
        $data = $request->validate(['reason' => 'required|string|min:3']);
        $row = $this->svc->suspend($row, $data['reason'], $request->user(), $request);
        return ApiResponse::success($row);
    }

    public function resume(Request $request, int $id)
    {
        $row = AmRoadmap::query()->findOrFail($id);
        try {
            $row = $this->svc->resume($row, $request->user(), $request);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
        return ApiResponse::success($row);
    }
}
