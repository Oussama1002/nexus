<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmAlertRuleTemplate;
use App\Models\AmChantierTemplate;
use App\Models\AmGateCriteriaTemplate;
use App\Models\AmGateTemplate;
use App\Models\AmHealthScoreConfig;
use App\Models\AmQaGridTemplate;
use App\Models\AmReportTemplate;
use App\Models\AmRoadmapTemplate;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Direction-only CRUD for AM configuration templates. Wired at
 * /api/am/config/{resource}. All writes are audited.
 */
class AmConfigController extends Controller
{
    /** Map of URL resource → [model class, editable fields]. */
    private array $resources = [];

    public function __construct()
    {
        $this->resources = [
            'roadmap-templates' => [AmRoadmapTemplate::class, [
                'code', 'label', 'description', 'is_active', 'is_default',
            ]],
            'chantier-templates' => [AmChantierTemplate::class, [
                'roadmap_template_id', 'code', 'label', 'objective', 'trigger',
                'prerequisite_gate_codes', 'steps_json', 'expected_deliverable_types_json',
                'output_kpis_json', 'academy_sop_ref', 'sort_order',
            ]],
            'gate-templates' => [AmGateTemplate::class, [
                'roadmap_template_id', 'chantier_template_id', 'code', 'label',
                'description', 'validator_role', 'unlocks_gate_codes_json',
                'unlocks_modules_json', 'is_scaling_gate', 'is_conversion_gate', 'sort_order',
            ]],
            'gate-criteria-templates' => [AmGateCriteriaTemplate::class, [
                'gate_template_id', 'label', 'verification_mode', 'source', 'operator',
                'threshold', 'description', 'is_mandatory', 'sort_order',
            ]],
            'qa-grid-templates' => [AmQaGridTemplate::class, [
                'deliverable_type', 'label', 'description', 'criteria_json', 'is_active',
            ]],
            'health-score-configs' => [AmHealthScoreConfig::class, [
                'brand_id', 'code', 'weights_json', 'components_json', 'is_active',
            ]],
            'alert-rule-templates' => [AmAlertRuleTemplate::class, [
                'code', 'label', 'severity', 'trigger_type', 'trigger_config_json',
                'default_recipient_role', 'target_resolution_minutes', 'is_active',
            ]],
            'report-templates' => [AmReportTemplate::class, [
                'code', 'label', 'sections_json', 'publishable_fields_whitelist', 'is_active',
            ]],
        ];
    }

    public function index(Request $request, string $resource): JsonResponse
    {
        [$class] = $this->resolve($resource);
        $rows = $class::query()->orderByDesc('id')->paginate((int) $request->query('per_page', 50));
        return ApiResponse::success($rows);
    }

    public function show(string $resource, string $id): JsonResponse
    {
        [$class] = $this->resolve($resource);
        return ApiResponse::success($class::query()->findOrFail($id));
    }

    public function store(Request $request, string $resource): JsonResponse
    {
        [$class, $fillable] = $this->resolve($resource);
        $data = $request->only($fillable);
        $row = $class::query()->create($data);
        AuditLogger::log($request, "am_config.{$resource}.create", $row, null, $row->toArray());
        return ApiResponse::success($row, 'Créé.');
    }

    public function update(Request $request, string $resource, string $id): JsonResponse
    {
        [$class, $fillable] = $this->resolve($resource);
        $row = $class::query()->findOrFail($id);
        $before = $row->toArray();
        $row->fill($request->only($fillable))->save();
        AuditLogger::log($request, "am_config.{$resource}.update", $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh(), 'Mis à jour.');
    }

    public function destroy(Request $request, string $resource, string $id): JsonResponse
    {
        [$class] = $this->resolve($resource);
        $row = $class::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();
        AuditLogger::log($request, "am_config.{$resource}.delete", null, $before, null);
        return ApiResponse::success(null, 'Supprimé.');
    }

    private function resolve(string $resource): array
    {
        if (! isset($this->resources[$resource])) {
            abort(404, "Ressource de configuration inconnue : {$resource}");
        }
        return $this->resources[$resource];
    }
}
