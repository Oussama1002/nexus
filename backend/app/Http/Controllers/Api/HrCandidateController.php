<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrCandidate;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrCandidateController extends Controller
{
    private const STATUSES = [
        'recue', 'a_examiner', 'preselectionne', 'contacte',
        'entretien', 'accepte', 'refuse', 'vivier', 'archive',
    ];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = HrCandidate::query()
            ->with(['jobOpening:id,title,department', 'decidedBy:id,name'])
            ->orderByDesc('id');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        if ($jobId = $request->query('job_opening_id')) {
            $q->where('job_opening_id', (int) $jobId);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($search = $request->query('search')) {
            $s = '%' . $search . '%';
            $q->where(function ($qq) use ($s) {
                $qq->where('full_name', 'like', $s)
                    ->orWhere('email', 'like', $s)
                    ->orWhere('phone', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'job_opening_id' => ['nullable', 'integer', 'exists:hr_job_openings,id'],
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'city' => ['nullable', 'string', 'max:255'],
            'cv_url' => ['nullable', 'string', 'max:500'],
            'cover_letter_url' => ['nullable', 'string', 'max:500'],
            'source' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['brand_id'] = $brandId;
        $data['status'] = 'recue';

        $row = HrCandidate::query()->create($data);

        AuditLogger::log($request, 'hr_candidates.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load('jobOpening:id,title'), 'Candidature ajoutée.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = HrCandidate::query()
            ->with(['jobOpening:id,title,department', 'decidedBy:id,name', 'convertedEmployee:id,full_name,employee_code'])
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = HrCandidate::query()->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'job_opening_id' => ['nullable', 'integer', 'exists:hr_job_openings,id'],
            'full_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'city' => ['nullable', 'string', 'max:255'],
            'cv_url' => ['nullable', 'string', 'max:500'],
            'cover_letter_url' => ['nullable', 'string', 'max:500'],
            'source' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'in:' . implode(',', self::STATUSES)],
            'notes' => ['nullable', 'string'],
            'refusal_reason' => ['nullable', 'string'],
            'contacted_at' => ['nullable', 'date'],
            'interview_at' => ['nullable', 'date'],
            'interview_notes' => ['nullable', 'string'],
            'interview_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'hr_candidates.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Candidature mise à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = HrCandidate::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'hr_candidates.delete', null, $before, null);

        return ApiResponse::success(null, 'Candidature supprimée.');
    }

    public function transition(Request $request, string $id): JsonResponse
    {
        $row = HrCandidate::query()->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', self::STATUSES)],
            'notes' => ['nullable', 'string'],
            'refusal_reason' => ['nullable', 'string'],
            'interview_at' => ['nullable', 'date'],
        ]);

        $row->status = $data['status'];

        if (isset($data['notes'])) {
            $row->notes = $data['notes'];
        }
        if (isset($data['refusal_reason'])) {
            $row->refusal_reason = $data['refusal_reason'];
        }
        if (isset($data['interview_at'])) {
            $row->interview_at = $data['interview_at'];
        }

        if ($data['status'] === 'contacte' && ! $row->contacted_at) {
            $row->contacted_at = now();
        }
        if (in_array($data['status'], ['accepte', 'refuse'], true)) {
            $row->decided_by_user_id = $request->user()->id;
            $row->decided_at = now();
        }

        $row->save();

        AuditLogger::log($request, 'hr_candidates.transition', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load('jobOpening:id,title'), 'Statut mis à jour.');
    }
}
