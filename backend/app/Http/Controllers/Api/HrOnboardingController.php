<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\HrOnboardingItem;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrOnboardingController extends Controller
{
    private const DEFAULT_ITEMS = [
        'contrat_signe' => 'Contrat signé',
        'cin_fournie' => 'CIN fournie',
        'cnss_declare' => 'CNSS déclaré',
        'rib_fourni' => 'RIB fourni',
        'acces_crm' => 'Accès CRM créé',
        'materiel_remis' => 'Matériel remis',
        'formation_accueil' => "Formation d'accueil",
        'reglement_interieur' => 'Règlement intérieur remis',
    ];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);

        $q = HrOnboardingItem::query()
            ->with(['employee:id,full_name,department', 'completedBy:id,name'])
            ->orderBy('employee_id')
            ->orderBy('id');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        if ($employeeId = $request->query('employee_id')) {
            $q->where('employee_id', (int) $employeeId);
        }

        return ApiResponse::success($q->get());
    }

    public function initChecklist(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
        ]);

        $existing = HrOnboardingItem::query()
            ->where('employee_id', $data['employee_id'])
            ->count();

        if ($existing > 0) {
            return ApiResponse::error('La checklist existe déjà pour cet employé.', null, 422);
        }

        $items = [];
        foreach (self::DEFAULT_ITEMS as $key => $label) {
            $items[] = HrOnboardingItem::query()->create([
                'brand_id' => $brandId,
                'employee_id' => $data['employee_id'],
                'item_key' => $key,
                'label' => $label,
            ]);
        }

        $employee = Employee::query()->find($data['employee_id']);
        if ($employee) {
            $employee->onboarding_status = 'en_cours';
            $employee->save();
        }

        AuditLogger::log($request, 'hr_onboarding.init', $employee, null, ['employee_id' => $data['employee_id'], 'items_count' => count($items)]);

        return ApiResponse::success($items, 'Checklist initialisée.', 201);
    }

    public function toggle(Request $request, string $id): JsonResponse
    {
        $item = HrOnboardingItem::query()->findOrFail($id);
        $before = $item->toArray();

        $item->is_completed = ! $item->is_completed;
        $item->completed_at = $item->is_completed ? now() : null;
        $item->completed_by_user_id = $item->is_completed ? $request->user()->id : null;
        $item->save();

        $allDone = HrOnboardingItem::query()
            ->where('employee_id', $item->employee_id)
            ->where('is_completed', false)
            ->doesntExist();

        if ($allDone) {
            $employee = Employee::query()->find($item->employee_id);
            if ($employee) {
                $employee->onboarding_status = 'termine';
                $employee->onboarding_completed_at = now();
                $employee->save();
            }
        }

        AuditLogger::log($request, 'hr_onboarding.toggle', $item, $before, $item->fresh()->toArray());

        return ApiResponse::success($item->fresh()->load('completedBy:id,name'), 'Élément mis à jour.');
    }

    public function addItem(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'item_key' => ['required', 'string', 'max:50'],
            'label' => ['required', 'string', 'max:255'],
        ]);

        $data['brand_id'] = $brandId;

        $row = HrOnboardingItem::query()->create($data);

        return ApiResponse::success($row, 'Élément ajouté.', 201);
    }
}
