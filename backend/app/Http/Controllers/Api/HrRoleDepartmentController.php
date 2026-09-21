<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrRoleDepartment;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HrRoleDepartmentController extends Controller
{
    public function index(): JsonResponse
    {
        return ApiResponse::success(
            HrRoleDepartment::query()->orderBy('department')->orderBy('role_title')->get(['role_title', 'department']),
            'Correspondances fonction / département.'
        );
    }

    public function replace(Request $request): JsonResponse
    {
        $data = $request->validate([
            'items' => ['present', 'array'],
            'items.*.role_title' => ['required', 'string', 'max:191'],
            'items.*.department' => ['required', 'string', 'max:191'],
        ], [
            'items.*.role_title.required' => 'Chaque ligne doit avoir une fonction.',
            'items.*.department.required' => 'Chaque ligne doit avoir un département.',
        ]);

        // One department per fonction: the last line wins on duplicates.
        $rows = collect($data['items'])
            ->map(fn ($i) => ['role_title' => trim($i['role_title']), 'department' => trim($i['department'])])
            ->filter(fn ($i) => $i['role_title'] !== '' && $i['department'] !== '')
            ->keyBy(fn ($i) => mb_strtolower($i['role_title']))
            ->values();

        $before = HrRoleDepartment::query()->get(['role_title', 'department'])->toArray();

        DB::transaction(function () use ($rows) {
            HrRoleDepartment::query()->delete();
            foreach ($rows as $row) {
                HrRoleDepartment::query()->create($row);
            }
        });

        AuditLogger::log($request, 'hr.role_departments.update', null, ['items' => $before], ['items' => $rows->all()]);

        return ApiResponse::success($rows->all(), 'Correspondances enregistrées.');
    }
}
