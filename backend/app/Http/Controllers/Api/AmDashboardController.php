<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmAlert;
use App\Models\AmClientReport;
use App\Models\AmDeliverable;
use App\Models\AmDerogation;
use App\Models\AmDiffusionSuspension;
use App\Models\AmGate;
use App\Models\AmRoadmap;
use App\Services\Am\AmHealthScoreService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

/**
 * 4 dashboard variants (spec §12):
 *   - direction    : portefeuille, alertes critiques, dérogations
 *   - manager_ops  : goulots gates, dérogations à décider, alertes
 *   - account_mgr  : mes marques, deadlines, prochaines réunions
 *   - client       : ma marque (roadmap simplifiée + rapports)
 */
class AmDashboardController extends Controller
{
    public function __construct(private readonly AmHealthScoreService $health) {}

    public function direction(Request $request)
    {
        return ApiResponse::success([
            'roadmaps_by_stage' => AmRoadmap::query()
                ->selectRaw('brand_lifecycle_stage, COUNT(*) as c')
                ->whereIn('status', ['en_cours', 'suspendue'])
                ->groupBy('brand_lifecycle_stage')
                ->pluck('c', 'brand_lifecycle_stage'),
            'critical_alerts' => AmAlert::query()
                ->whereIn('severity', ['high', 'critical'])
                ->whereIn('status', ['ouverte', 'escaladee'])
                ->orderByDesc('id')
                ->limit(20)
                ->get(),
            'derogations_pending' => AmDerogation::query()->where('status', 'demandee')->count(),
            'diffusion_suspensions' => AmDiffusionSuspension::query()->where('is_active', true)->count(),
            'reports_awaiting_validation' => AmClientReport::query()->whereIn('status', ['brouillon', 'a_valider'])->count(),
        ]);
    }

    public function managerOps(Request $request)
    {
        return ApiResponse::success([
            'gates_pending' => AmGate::query()
                ->where('status', 'demandee')
                ->with(['brand:id,name', 'template:id,label'])
                ->orderBy('requested_at')
                ->limit(20)->get(),
            'derogations_to_decide' => AmDerogation::query()
                ->where('status', 'demandee')
                ->with(['gate:id,code,brand_id', 'brand:id,name'])
                ->limit(20)->get(),
            'alerts_open' => AmAlert::query()
                ->whereIn('status', ['ouverte', 'prise_en_charge'])
                ->orderByDesc('severity')
                ->limit(20)->get(),
            'deliverables_late' => AmDeliverable::query()
                ->whereIn('status', ['a_produire', 'en_production', 'depose', 'en_controle', 'a_corriger'])
                ->whereDate('deadline', '<', now())
                ->count(),
        ]);
    }

    public function accountManager(Request $request)
    {
        $uid = $request->user()->id;
        return ApiResponse::success([
            'my_roadmaps' => AmRoadmap::query()
                ->where('account_manager_user_id', $uid)
                ->whereIn('status', ['en_cours', 'suspendue'])
                ->with(['brand:id,name'])
                ->get(),
            'my_deliverables_upcoming' => AmDeliverable::query()
                ->where('producer_user_id', $uid)
                ->whereIn('status', ['a_produire', 'en_production', 'a_corriger'])
                ->orderBy('deadline')
                ->limit(20)->get(),
            'my_alerts' => AmAlert::query()
                ->where('recipient_user_id', $uid)
                ->whereIn('status', ['ouverte', 'prise_en_charge'])
                ->get(),
        ]);
    }

    public function client(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $roadmap = AmRoadmap::query()
            ->where('brand_id', $brandId)
            ->whereIn('status', ['en_cours', 'suspendue', 'terminee'])
            ->with(['gates.template:id,code,label'])
            ->latest()
            ->first();
        return ApiResponse::success([
            'roadmap' => $roadmap,
            'health_score' => $this->health->computeForBrand($brandId),
            'reports_published' => AmClientReport::query()
                ->where('brand_id', $brandId)
                ->where('status', 'publie')
                ->orderByDesc('published_at')
                ->limit(10)->get(),
        ]);
    }

    public function healthScore(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        return ApiResponse::success($this->health->computeForBrand($brandId));
    }
}
