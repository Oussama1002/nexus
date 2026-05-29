<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CollabProject;
use App\Models\CollabProjectMember;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CollabProjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 30), 1), 100);
        $status = trim((string) $request->query('status', ''));
        $search = trim((string) $request->query('search', ''));

        $q = CollabProject::query()
            ->where('brand_id', $brandId)
            ->with([
                'createdBy:id,name',
                'members.user:id,name,email',
            ])
            ->orderByDesc('id');

        if ($status !== '') {
            $q->where('status', $status);
        }

        if ($search !== '') {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('title', 'like', $s)
                    ->orWhere('objective', 'like', $s)
                    ->orWhere('notes', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Collaborative projects retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $this->validateProject($request);
        $data['brand_id'] = $brandId;
        $data['created_by_user_id'] = $request->user()?->id;
        $members = $request->input('members', []);

        $project = CollabProject::query()->create($data);
        $this->syncMembers($project, is_array($members) ? $members : [], $brandId, false);

        AuditLogger::log($request, 'collab_projects.create', $project, null, $project->toArray());

        return ApiResponse::success(
            $project->fresh(['createdBy:id,name', 'members.user:id,name,email']),
            'Collaborative project created successfully.',
            201
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $project = CollabProject::query()
            ->where('brand_id', $brandId)
            ->with(['createdBy:id,name', 'members.user:id,name,email'])
            ->findOrFail($id);

        return ApiResponse::success($project, 'Collaborative project retrieved successfully.');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $project = CollabProject::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $project->toArray();
        $data = $this->validateProject($request, true);
        $project->fill($data);
        $project->save();
        if ($request->has('members') && is_array($request->input('members'))) {
            $this->syncMembers($project, $request->input('members'), $brandId, true);
        }

        AuditLogger::log($request, 'collab_projects.update', $project, $before, $project->fresh()->toArray());

        return ApiResponse::success(
            $project->fresh(['createdBy:id,name', 'members.user:id,name,email']),
            'Collaborative project updated successfully.'
        );
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $project = CollabProject::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $project->toArray();
        $project->delete();
        AuditLogger::log($request, 'collab_projects.delete', null, $before, null);

        return ApiResponse::success(null, 'Collaborative project deleted successfully.');
    }

    public function addMember(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $project = CollabProject::query()->where('brand_id', $brandId)->findOrFail($id);
        $data = $this->validateMember($request, $brandId);

        $member = CollabProjectMember::query()->updateOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => (int) $data['user_id'],
                'project_role' => $data['project_role'],
            ],
            [
                'is_lead' => (bool) ($data['is_lead'] ?? false),
            ]
        );

        AuditLogger::log($request, 'collab_projects.member_add', $project, null, $member->toArray());

        return ApiResponse::success(
            $project->fresh(['createdBy:id,name', 'members.user:id,name,email']),
            'Project member linked successfully.'
        );
    }

    public function removeMember(Request $request, string $id, string $memberId): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $project = CollabProject::query()->where('brand_id', $brandId)->findOrFail($id);
        $member = CollabProjectMember::query()
            ->where('project_id', $project->id)
            ->findOrFail($memberId);
        $before = $member->toArray();
        $member->delete();
        AuditLogger::log($request, 'collab_projects.member_remove', $project, $before, null);

        return ApiResponse::success(
            $project->fresh(['createdBy:id,name', 'members.user:id,name,email']),
            'Project member removed.'
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function validateProject(Request $request, bool $partial = false): array
    {
        $prefix = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'title' => [$prefix, 'string', 'max:255'],
            'objective' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['draft', 'in_progress', 'blocked', 'review', 'published', 'done'])],
            'due_date' => ['nullable', 'date'],
            'asset_url' => ['nullable', 'url', 'max:2048'],
            'notes' => ['nullable', 'string'],
            'members' => ['nullable', 'array'],
            'members.*.user_id' => ['required_with:members', 'integer'],
            'members.*.project_role' => ['required_with:members', Rule::in(['content_creator', 'video_editor', 'copywriter', 'publisher', 'reviewer', 'other'])],
            'members.*.is_lead' => ['nullable', 'boolean'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateMember(Request $request, int $brandId): array
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer'],
            'project_role' => ['required', Rule::in(['content_creator', 'video_editor', 'copywriter', 'publisher', 'reviewer', 'other'])],
            'is_lead' => ['nullable', 'boolean'],
        ]);

        User::query()
            ->whereKey((int) $data['user_id'])
            ->whereHas('brands', fn ($q) => $q->where('brands.id', $brandId))
            ->firstOrFail();

        return $data;
    }

    /**
     * @param  array<int, array<string, mixed>>  $members
     */
    private function syncMembers(CollabProject $project, array $members, int $brandId, bool $replace): void
    {
        if ($replace) {
            $project->members()->delete();
        }

        foreach ($members as $member) {
            if (! is_array($member)) {
                continue;
            }
            if (! isset($member['user_id'], $member['project_role'])) {
                continue;
            }
            User::query()
                ->whereKey((int) $member['user_id'])
                ->whereHas('brands', fn ($q) => $q->where('brands.id', $brandId))
                ->firstOrFail();
            CollabProjectMember::query()->updateOrCreate(
                [
                    'project_id' => $project->id,
                    'user_id' => (int) $member['user_id'],
                    'project_role' => (string) $member['project_role'],
                ],
                ['is_lead' => ! empty($member['is_lead'])]
            );
        }
    }
}
