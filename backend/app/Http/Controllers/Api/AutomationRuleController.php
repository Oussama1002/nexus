<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Services\AuditService;
use App\Services\AutomationEngineService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class AutomationRuleController extends Controller
{
    /** Evenements decrits dans l'interface, avec leurs champs et conditions. */
    private const BUILTIN_TRIGGERS = [
        'attendance.marked',
        'order.status_changed',
        'order.created',
        'shipment.status_changed',
        'lead.created',
        'stock.shortage',
    ];

    /**
     * Forme d'une cle d'evenement : « module.action ». Toute action journalisee
     * par le CRM en est une, d'ou une validation de forme plutot qu'une liste.
     */
    private const TRIGGER_PATTERN = 'regex:/^[a-z0-9_]+(\\.[a-z0-9_]+)+$/';

    /**
     * Evenements disponibles : ceux decrits dans l'interface, plus toutes les
     * actions que le CRM a deja journalisees pour cette marque.
     */
    public function availableTriggers(Request $request): JsonResponse
    {
        $seen = \App\Models\AuditLog::query()
            ->selectRaw('action, COUNT(*) as total')
            ->whereNotNull('action')
            ->groupBy('action')
            ->orderByDesc('total')
            ->limit(200)
            ->get();

        $rows = [];
        foreach (self::BUILTIN_TRIGGERS as $key) {
            $rows[$key] = ['key' => $key, 'builtin' => true, 'occurrences' => 0];
        }

        foreach ($seen as $row) {
            $key = (string) $row->action;
            if (! preg_match('/^[a-z0-9_]+(\.[a-z0-9_]+)+$/', $key)) {
                continue;
            }
            $rows[$key] = [
                'key' => $key,
                'builtin' => $rows[$key]['builtin'] ?? false,
                'occurrences' => (int) $row->total,
            ];
        }

        return ApiResponse::success(array_values($rows), 'Evenements disponibles.');
    }

    public function __construct(
        private readonly AutomationEngineService $engine
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'automations.view');
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);
        $trigger = trim((string) $request->query('trigger', ''));
        $search = trim((string) $request->query('search', ''));

        $q = AutomationRule::query()
            ->with(['createdBy:id,name', 'updatedBy:id,name']);
        if ($brandId !== null) {
            $q->where(function ($w) use ($brandId) {
                $w->where('brand_id', $brandId)->orWhereNull('brand_id');
            });
        }
        $q->orderByDesc('id');
        if ($trigger !== '') {
            $q->where('trigger_key', $trigger);
        }
        if ($search !== '') {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', $s)
                    ->orWhere('description', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Automation rules retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'automations.create');
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'trigger_key' => ['required', 'string', 'max:100', self::TRIGGER_PATTERN],
            'condition_json' => ['nullable', 'array'],
            'action_json' => ['required', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $data['brand_id'] = $brandId;
        $data['created_by_user_id'] = $request->user()?->id;
        $data['updated_by_user_id'] = $request->user()?->id;
        $rule = AutomationRule::query()->create($data);
        AuditService::log($request, 'automations.create', $rule, null, $rule->toArray());

        return ApiResponse::success($rule->fresh(['createdBy:id,name', 'updatedBy:id,name']), 'Automation rule created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->requirePermission($request, 'automations.view');
        $rule = AutomationRule::query()
            ->with(['createdBy:id,name', 'updatedBy:id,name'])
            ->findOrFail($id);

        return ApiResponse::success($rule, 'Automation rule retrieved successfully.');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $this->requirePermission($request, 'automations.update');
        $rule = AutomationRule::query()->findOrFail($id);
        $before = $rule->toArray();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'trigger_key' => ['sometimes', 'string', 'max:100', self::TRIGGER_PATTERN],
            'condition_json' => ['nullable', 'array'],
            'action_json' => ['sometimes', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $data['updated_by_user_id'] = $request->user()?->id;
        $rule->fill($data);
        $rule->save();
        AuditService::log($request, 'automations.update', $rule, $before, $rule->fresh()->toArray());

        return ApiResponse::success($rule->fresh(['createdBy:id,name', 'updatedBy:id,name']), 'Automation rule updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->requirePermission($request, 'automations.delete');
        $rule = AutomationRule::query()->findOrFail($id);
        $before = $rule->toArray();
        $rule->delete();
        AuditService::log($request, 'automations.delete', null, $before, null);

        return ApiResponse::success(null, 'Automation rule deleted successfully.');
    }

    public function test(Request $request, string $id): JsonResponse
    {
        $this->requirePermission($request, 'automations.run');
        $rule = AutomationRule::query()->findOrFail($id);
        $data = $request->validate([
            'event_payload' => ['required', 'array'],
        ]);
        $result = $this->engine->testRule($rule, $data['event_payload']);

        return ApiResponse::success($result, 'Automation test executed.');
    }

    public function runs(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'automations.view');
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);
        $ruleId = $request->query('rule_id');

        $q = AutomationRun::query()
            ->with('rule:id,name,trigger_key')
            ->orderByDesc('id');
        if ($brandId !== null) {
            $q->where(function ($w) use ($brandId) {
                $w->where('brand_id', $brandId)->orWhereNull('brand_id');
            });
        }

        if ($ruleId) {
            $q->where('automation_rule_id', (int) $ruleId);
        }

        return ApiResponse::success($q->paginate($perPage), 'Automation runs retrieved successfully.');
    }

    private function requirePermission(Request $request, string $slug): void
    {
        if (! $request->user()?->hasPermissionSlug($slug)) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
