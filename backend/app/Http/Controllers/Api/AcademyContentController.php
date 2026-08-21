<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademyContent;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AcademyContentController extends Controller
{
    /**
     * Frontend contract: { id, title, type, path_name, duration, author,
     * views_count, rating, status, updated_at }
     */
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $q = AcademyContent::query()
            ->with(['learningPath:id,title', 'author:id,name'])
            ->orderByDesc('updated_at');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($type = $request->query('type')) $q->where('type', $type);
        if ($search = $request->query('search')) {
            $q->where(function ($qq) use ($search) {
                $qq->where('title', 'like', "%{$search}%")->orWhere('description', 'like', "%{$search}%");
            });
        }

        $paginator = $q->paginate($perPage);
        $mapped = $paginator->getCollection()->map(fn ($c) => [
            'id' => $c->id,
            'title' => $c->title,
            'type' => $c->type,
            'path_name' => $c->learningPath?->title,
            'duration' => $c->duration_minutes ? $this->formatDuration((int) $c->duration_minutes) : null,
            'author' => $c->author?->name ?? '—',
            'views_count' => (int) $c->views_count,
            'rating' => $c->rating !== null ? (float) $c->rating : null,
            'status' => $c->status,
            'updated_at' => $c->updated_at?->toIso8601String(),
        ]);
        $paginator->setCollection($mapped);
        return ApiResponse::success($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'in:video,article,quiz,document,exercise'],
            'description' => ['nullable', 'string'],
            'media_url' => ['nullable', 'string', 'max:500'],
            'duration_minutes' => ['nullable', 'integer', 'min:0'],
            'learning_path_id' => ['nullable', 'integer', 'exists:academy_learning_paths,id'],
            'status' => ['nullable', 'string', 'in:published,draft,archived'],
        ]);
        $data['brand_id'] = $brandId;
        $data['author_user_id'] = $request->user()->id;
        $data['status'] = $data['status'] ?? 'draft';
        $row = AcademyContent::query()->create($data);
        AuditLogger::log($request, 'academy_content.create', $row);
        return ApiResponse::success($row->fresh(), 'Contenu créé.', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = AcademyContent::query()->findOrFail($id);
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'in:video,article,quiz,document,exercise'],
            'description' => ['nullable', 'string'],
            'media_url' => ['nullable', 'string', 'max:500'],
            'duration_minutes' => ['nullable', 'integer', 'min:0'],
            'learning_path_id' => ['nullable', 'integer', 'exists:academy_learning_paths,id'],
            'status' => ['nullable', 'string', 'in:published,draft,archived'],
            'rating' => ['nullable', 'numeric', 'min:0', 'max:5'],
        ]);
        $row->fill($data)->save();
        AuditLogger::log($request, 'academy_content.update', $row);
        return ApiResponse::success($row->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = AcademyContent::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();
        AuditLogger::log($request, 'academy_content.delete', null, $before, null);
        return ApiResponse::success(null, 'Contenu supprimé.');
    }

    public function incrementView(Request $request, string $id): JsonResponse
    {
        $row = AcademyContent::query()->findOrFail($id);
        $row->increment('views_count');
        return ApiResponse::success(['views_count' => $row->views_count]);
    }

    private function formatDuration(int $mins): string
    {
        if ($mins < 60) return "{$mins} min";
        $h = intdiv($mins, 60);
        $m = $mins % 60;
        return $m > 0 ? "{$h}h {$m}min" : "{$h}h";
    }
}
