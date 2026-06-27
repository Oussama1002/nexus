<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CollabColumn;
use App\Models\CollabProject;
use App\Models\CollabTask;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CollabKanbanController extends Controller
{
    /* ── helpers ── */

    private function findProject(Request $request, int $projectId): CollabProject
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        return CollabProject::query()
            ->where('brand_id', $brandId)
            ->findOrFail($projectId);
    }

    /* ══════════ BOARD (full read) ══════════ */

    public function board(Request $request, int $projectId): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $projectQuery = CollabProject::query();
        ApiBrandContext::scopeBrand($projectQuery, $brandId);
        $project = $projectQuery->findOrFail($projectId);

        $columns = CollabColumn::query()
            ->where('project_id', $project->id)
            ->with(['tasks' => fn ($q) => $q->with('assignee:id,name')->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get();

        return ApiResponse::success([
            'project' => $project->only(['id', 'title', 'status']),
            'columns' => $columns->map(fn ($col) => [
                'id' => $col->id,
                'title' => $col->title,
                'color' => $col->color,
                'sort_order' => $col->sort_order,
                'tasks' => $col->tasks->map(fn ($t) => [
                    'id' => $t->id,
                    'column_id' => $t->column_id,
                    'title' => $t->title,
                    'description' => $t->description,
                    'priority' => $t->priority,
                    'due_date' => $t->due_date?->toDateString(),
                    'sort_order' => $t->sort_order,
                    'assigned_to' => $t->assigned_to,
                    'assignee_name' => $t->assignee?->name,
                ])->values(),
            ])->values(),
        ], 'Board loaded.');
    }

    /* ══════════ COLUMNS ══════════ */

    public function storeColumn(Request $request, int $projectId): JsonResponse
    {
        $project = $this->findProject($request, $projectId);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'max:20'],
        ]);

        $maxOrder = CollabColumn::query()
            ->where('project_id', $project->id)
            ->max('sort_order') ?? -1;

        $col = CollabColumn::query()->create([
            'project_id' => $project->id,
            'title' => $data['title'],
            'color' => $data['color'] ?? '#6366f1',
            'sort_order' => $maxOrder + 1,
        ]);

        return ApiResponse::success($col->toArray(), 'Column created.', 201);
    }

    public function updateColumn(Request $request, int $projectId, int $columnId): JsonResponse
    {
        $project = $this->findProject($request, $projectId);

        $col = CollabColumn::query()
            ->where('project_id', $project->id)
            ->findOrFail($columnId);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:100'],
            'color' => ['sometimes', 'string', 'max:20'],
        ]);

        $col->update($data);

        return ApiResponse::success($col->fresh()->toArray(), 'Column updated.');
    }

    public function destroyColumn(Request $request, int $projectId, int $columnId): JsonResponse
    {
        $project = $this->findProject($request, $projectId);

        $col = CollabColumn::query()
            ->where('project_id', $project->id)
            ->findOrFail($columnId);

        $col->delete();

        return ApiResponse::success(null, 'Column deleted.');
    }

    public function reorderColumns(Request $request, int $projectId): JsonResponse
    {
        $project = $this->findProject($request, $projectId);

        $data = $request->validate([
            'order' => ['required', 'array'],
            'order.*' => ['integer'],
        ]);

        DB::transaction(function () use ($data, $project) {
            foreach ($data['order'] as $index => $colId) {
                CollabColumn::query()
                    ->where('project_id', $project->id)
                    ->where('id', $colId)
                    ->update(['sort_order' => $index]);
            }
        });

        return ApiResponse::success(null, 'Columns reordered.');
    }

    /* ══════════ TASKS ══════════ */

    public function storeTask(Request $request, int $projectId): JsonResponse
    {
        $project = $this->findProject($request, $projectId);

        $data = $request->validate([
            'column_id' => ['required', 'integer', 'exists:collab_columns,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'priority' => ['nullable', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'due_date' => ['nullable', 'date'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        CollabColumn::query()
            ->where('project_id', $project->id)
            ->where('id', $data['column_id'])
            ->firstOrFail();

        $maxOrder = CollabTask::query()
            ->where('column_id', $data['column_id'])
            ->max('sort_order') ?? -1;

        $task = CollabTask::query()->create([
            'project_id' => $project->id,
            'column_id' => $data['column_id'],
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'priority' => $data['priority'] ?? 'medium',
            'due_date' => $data['due_date'] ?? null,
            'assigned_to' => $data['assigned_to'] ?? null,
            'sort_order' => $maxOrder + 1,
        ]);

        $task->load('assignee:id,name');

        return ApiResponse::success([
            'id' => $task->id,
            'column_id' => $task->column_id,
            'title' => $task->title,
            'description' => $task->description,
            'priority' => $task->priority,
            'due_date' => $task->due_date?->toDateString(),
            'sort_order' => $task->sort_order,
            'assigned_to' => $task->assigned_to,
            'assignee_name' => $task->assignee?->name,
        ], 'Task created.', 201);
    }

    public function updateTask(Request $request, int $projectId, int $taskId): JsonResponse
    {
        $project = $this->findProject($request, $projectId);

        $task = CollabTask::query()
            ->where('project_id', $project->id)
            ->findOrFail($taskId);

        $data = $request->validate([
            'column_id' => ['sometimes', 'integer', 'exists:collab_columns,id'],
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'due_date' => ['nullable', 'date'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        if (isset($data['column_id'])) {
            CollabColumn::query()
                ->where('project_id', $project->id)
                ->where('id', $data['column_id'])
                ->firstOrFail();
        }

        $task->update($data);
        $task->load('assignee:id,name');

        return ApiResponse::success([
            'id' => $task->id,
            'column_id' => $task->column_id,
            'title' => $task->title,
            'description' => $task->description,
            'priority' => $task->priority,
            'due_date' => $task->due_date?->toDateString(),
            'sort_order' => $task->sort_order,
            'assigned_to' => $task->assigned_to,
            'assignee_name' => $task->assignee?->name,
        ], 'Task updated.');
    }

    public function destroyTask(Request $request, int $projectId, int $taskId): JsonResponse
    {
        $project = $this->findProject($request, $projectId);

        CollabTask::query()
            ->where('project_id', $project->id)
            ->findOrFail($taskId)
            ->delete();

        return ApiResponse::success(null, 'Task deleted.');
    }

    public function moveTask(Request $request, int $projectId, int $taskId): JsonResponse
    {
        $project = $this->findProject($request, $projectId);

        $task = CollabTask::query()
            ->where('project_id', $project->id)
            ->findOrFail($taskId);

        $data = $request->validate([
            'column_id' => ['required', 'integer', 'exists:collab_columns,id'],
            'sort_order' => ['required', 'integer', 'min:0'],
        ]);

        CollabColumn::query()
            ->where('project_id', $project->id)
            ->where('id', $data['column_id'])
            ->firstOrFail();

        DB::transaction(function () use ($task, $data) {
            if ((int) $task->column_id !== (int) $data['column_id']) {
                CollabTask::query()
                    ->where('column_id', $task->column_id)
                    ->where('sort_order', '>', $task->sort_order)
                    ->decrement('sort_order');
            }

            CollabTask::query()
                ->where('column_id', $data['column_id'])
                ->where('sort_order', '>=', $data['sort_order'])
                ->increment('sort_order');

            $task->update([
                'column_id' => $data['column_id'],
                'sort_order' => $data['sort_order'],
            ]);
        });

        return ApiResponse::success(null, 'Task moved.');
    }
}
