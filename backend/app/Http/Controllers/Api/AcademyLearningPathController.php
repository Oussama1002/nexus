<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademyContent;
use App\Models\AcademyLearningPath;
use App\Models\AcademyLearningPathEnrollment;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AcademyLearningPathController extends Controller
{
    /**
     * Frontend contract: { id, title, description, modules_count, duration_hours,
     * enrolled_count, completion_rate, level, status }
     */
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $q = AcademyLearningPath::query()->orderByDesc('id');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($level = $request->query('level')) $q->where('level', $level);
        if ($search = $request->query('search')) {
            $q->where(function ($qq) use ($search) {
                $qq->where('title', 'like', "%{$search}%")->orWhere('description', 'like', "%{$search}%");
            });
        }

        $paginator = $q->paginate($perPage);
        $pathIds = $paginator->getCollection()->pluck('id')->all();

        // Modules count = academy_contents for the path
        $modulesByPath = [];
        if ($pathIds) {
            $modulesByPath = AcademyContent::query()
                ->whereIn('learning_path_id', $pathIds)
                ->selectRaw('learning_path_id, COUNT(*) as c')
                ->groupBy('learning_path_id')
                ->pluck('c', 'learning_path_id')->all();
        }

        // Enrolled + completed counts
        $enrolledByPath = [];
        $completedByPath = [];
        if ($pathIds) {
            $rows = AcademyLearningPathEnrollment::query()
                ->whereIn('learning_path_id', $pathIds)
                ->selectRaw('learning_path_id, COUNT(*) as e, SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as c')
                ->groupBy('learning_path_id')->get();
            foreach ($rows as $r) {
                $enrolledByPath[$r->learning_path_id] = (int) $r->e;
                $completedByPath[$r->learning_path_id] = (int) $r->c;
            }
        }

        $mapped = $paginator->getCollection()->map(function ($p) use ($modulesByPath, $enrolledByPath, $completedByPath) {
            $enrolled = (int) ($enrolledByPath[$p->id] ?? 0);
            $completed = (int) ($completedByPath[$p->id] ?? 0);
            return [
                'id' => $p->id,
                'title' => $p->title,
                'description' => $p->description ?? '',
                'modules_count' => (int) ($modulesByPath[$p->id] ?? 0),
                'duration_hours' => (float) $p->duration_hours,
                'enrolled_count' => $enrolled,
                'completion_rate' => $enrolled > 0 ? round(($completed / $enrolled) * 100, 1) : 0.0,
                'level' => $p->level,
                'status' => $p->status,
            ];
        });
        $paginator->setCollection($mapped);
        return ApiResponse::success($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'level' => ['nullable', 'string', 'in:beginner,intermediate,advanced'],
            'duration_hours' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', 'in:active,draft,archived'],
        ]);
        $data['brand_id'] = $brandId;
        $data['created_by_user_id'] = $request->user()->id;
        $data['status'] = $data['status'] ?? 'draft';
        $row = AcademyLearningPath::query()->create($data);
        AuditLogger::log($request, 'learning_path.create', $row);
        return ApiResponse::success($row->fresh(), 'Parcours créé.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = AcademyLearningPath::query()->with(['contents', 'createdBy:id,name'])->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = AcademyLearningPath::query()->findOrFail($id);
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'level' => ['nullable', 'string', 'in:beginner,intermediate,advanced'],
            'duration_hours' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', 'in:active,draft,archived'],
        ]);
        $row->fill($data)->save();
        AuditLogger::log($request, 'learning_path.update', $row);
        return ApiResponse::success($row->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = AcademyLearningPath::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();
        AuditLogger::log($request, 'learning_path.delete', null, $before, null);
        return ApiResponse::success(null, 'Parcours supprimé.');
    }

    public function enroll(Request $request, string $id): JsonResponse
    {
        $row = AcademyLearningPath::query()->findOrFail($id);
        $data = $request->validate(['user_id' => ['required', 'integer', 'exists:users,id']]);
        $en = AcademyLearningPathEnrollment::query()->updateOrCreate(
            ['learning_path_id' => $row->id, 'user_id' => $data['user_id']],
            ['enrolled_at' => now()],
        );
        AuditLogger::log($request, 'learning_path.enroll', $en);
        return ApiResponse::success($en->fresh(), 'Inscrit.');
    }
}
