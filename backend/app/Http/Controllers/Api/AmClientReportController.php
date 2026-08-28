<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmClientReport;
use App\Services\Am\AmReportGeneratorService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use RuntimeException;

class AmClientReportController extends Controller
{
    public function __construct(private readonly AmReportGeneratorService $svc) {}

    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmClientReport::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->with(['template:id,label'])
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function show(int $id)
    {
        return ApiResponse::success(AmClientReport::query()->with(['template'])->findOrFail($id));
    }

    public function draft(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'template_id' => 'required|integer|exists:am_report_templates,id',
            'period' => 'required|string|max:20',
            'sections' => 'nullable|array',
            'account_manager_comment' => 'nullable|string',
        ]);
        $report = $this->svc->draft($brandId, (int) $data['template_id'], $data['period'], $data['sections'] ?? [], $data['account_manager_comment'] ?? null, $request->user(), $request);
        return ApiResponse::success($report, 'Brouillon créé.', 201);
    }

    public function validateReport(Request $request, int $id)
    {
        $row = AmClientReport::query()->findOrFail($id);
        try {
            $row = $this->svc->validate($row, $request->user(), $request);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
        return ApiResponse::success($row);
    }

    public function publish(Request $request, int $id)
    {
        $row = AmClientReport::query()->findOrFail($id);
        $data = $request->validate(['recipient_user_ids' => 'required|array|min:1']);
        try {
            $row = $this->svc->publish($row, array_map('intval', $data['recipient_user_ids']), $request->user(), $request);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
        return ApiResponse::success($row);
    }
}
