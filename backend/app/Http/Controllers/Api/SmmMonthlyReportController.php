<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmMonthlyReport;
use App\Services\AuditLogger;
use App\Services\Smm\SmmNotificationService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmMonthlyReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $q = SmmMonthlyReport::query()->with(['author:id,name', 'diffusedBy:id,name'])->orderByDesc('year')->orderByDesc('month');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        return ApiResponse::success($q->paginate((int) $request->query('per_page', 25)));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'year' => ['required', 'integer'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'performance_summary' => ['nullable', 'string'],
            'winning_contents_json' => ['nullable', 'array'],
            'underperforming_contents_json' => ['nullable', 'array'],
            'patterns_identified' => ['nullable', 'string'],
            'decision_grid_json' => ['nullable', 'array'],
            'next_month_action_plan' => ['nullable', 'string'],
        ]);
        $data['brand_id'] = $brandId;
        $data['author_user_id'] = $request->user()->id;
        $data['status'] = 'en_preparation';
        $row = SmmMonthlyReport::query()->create($data);
        AuditLogger::log($request, 'smm_report.create', $row);
        return ApiResponse::success($row, 'Rapport créé.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = SmmMonthlyReport::query()->with(['author:id,name', 'diffusedBy:id,name'])->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = SmmMonthlyReport::query()->findOrFail($id);
        if ($row->status === 'diffuse') return ApiResponse::error('Rapport diffusé, non modifiable.', null, 422);
        $data = $request->validate([
            'performance_summary' => ['nullable', 'string'],
            'winning_contents_json' => ['nullable', 'array'],
            'underperforming_contents_json' => ['nullable', 'array'],
            'patterns_identified' => ['nullable', 'string'],
            'decision_grid_json' => ['nullable', 'array'],
            'next_month_action_plan' => ['nullable', 'string'],
            'recipient_user_ids_json' => ['nullable', 'array'],
        ]);
        $row->fill($data)->save();
        return ApiResponse::success($row->fresh());
    }

    public function diffuse(Request $request, string $id): JsonResponse
    {
        $row = SmmMonthlyReport::query()->findOrFail($id);
        // Enforce decision grid fully filled
        $grid = $row->decision_grid_json ?? [];
        foreach (['keep', 'stop', 'improve', 'test', 'scale'] as $bucket) {
            if (!array_key_exists($bucket, $grid)) {
                return ApiResponse::error('Grille de décision KEEP/STOP/IMPROVE/TEST/SCALE incomplète.', null, 422);
            }
        }
        $row->status = 'diffuse';
        $row->diffused_at = now();
        $row->diffused_by_user_id = $request->user()->id;
        $row->save();
        AuditLogger::log($request, 'smm_report.diffuse', $row);
        $label = str_pad((string) $row->month, 2, '0', STR_PAD_LEFT) . '/' . $row->year;
        // Broadcast to Manager OPS + Direction + explicit recipients if any
        SmmNotificationService::notifySmmAndOps(
            $row->brand_id, 'monthly_report_diffused', 'Rapport mensuel diffusé',
            "Le rapport {$label} vient d'être diffusé.",
            ['report_id' => $row->id], 'smm_monthly_report', $row->id,
        );
        foreach ((array) $row->recipient_user_ids_json as $uid) {
            SmmNotificationService::notifyUser(
                (int) $uid, $row->brand_id, 'monthly_report_diffused',
                'Rapport mensuel', "Le rapport {$label} est disponible.",
                ['report_id' => $row->id], 'smm_monthly_report', $row->id,
            );
        }
        return ApiResponse::success($row->fresh(), 'Rapport diffusé.');
    }
}
