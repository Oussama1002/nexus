<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrJobOpening;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrJobOpeningController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = HrJobOpening::query()
            ->with(['createdBy:id,name'])
            ->withCount('candidates')
            ->orderByDesc('id');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($department = $request->query('department')) {
            $q->where('department', $department);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'requirements' => ['nullable', 'string'],
            'contract_type' => ['nullable', 'string', 'max:20'],
            'location' => ['nullable', 'string', 'max:255'],
            'salary_min' => ['nullable', 'numeric', 'min:0'],
            'salary_max' => ['nullable', 'numeric', 'min:0'],
            'positions_count' => ['nullable', 'integer', 'min:1'],
        ]);

        $data['brand_id'] = $brandId;
        $data['status'] = 'ouvert';
        $data['created_by_user_id'] = $request->user()->id;

        $row = HrJobOpening::query()->create($data);

        AuditLogger::log($request, 'hr_job_openings.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load('createdBy:id,name'), 'Poste créé.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = HrJobOpening::query()
            ->with(['createdBy:id,name', 'candidates'])
            ->withCount('candidates')
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = HrJobOpening::query()->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'requirements' => ['nullable', 'string'],
            'contract_type' => ['nullable', 'string', 'max:20'],
            'location' => ['nullable', 'string', 'max:255'],
            'salary_min' => ['nullable', 'numeric', 'min:0'],
            'salary_max' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', 'max:20'],
            'positions_count' => ['nullable', 'integer', 'min:1'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'hr_job_openings.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Poste mis à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = HrJobOpening::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'hr_job_openings.delete', null, $before, null);

        return ApiResponse::success(null, 'Poste supprimé.');
    }

    public function publish(Request $request, string $id): JsonResponse
    {
        $row = HrJobOpening::query()->findOrFail($id);
        $before = $row->toArray();

        $row->status = 'publie';
        $row->published_at = now()->toDateString();
        $row->save();

        AuditLogger::log($request, 'hr_job_openings.publish', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Poste publié.');
    }

    public function close(Request $request, string $id): JsonResponse
    {
        $row = HrJobOpening::query()->findOrFail($id);
        $before = $row->toArray();

        $row->status = 'ferme';
        $row->closed_at = now()->toDateString();
        $row->save();

        AuditLogger::log($request, 'hr_job_openings.close', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Poste fermé.');
    }
}
