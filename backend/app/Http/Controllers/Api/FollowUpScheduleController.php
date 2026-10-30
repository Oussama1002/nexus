<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FollowUpSchedule;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FollowUpScheduleController extends Controller
{
    /** Calendrier GO-CENTER par défaut, retourné quand aucun n'est défini. */
    private const DEFAULT = ['offsets' => [7, 14, 21, 28, 35, 42, 57, 72], 'repeat_every_days' => 30];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $schedules = FollowUpSchedule::query()
            ->where('brand_id', $brandId)
            ->with('product:id,name')
            ->orderByRaw('product_id is null desc')
            ->get()
            ->map(fn (FollowUpSchedule $s) => [
                'id' => $s->id,
                'product_id' => $s->product_id,
                'product_name' => $s->product?->name,
                'offsets' => $s->offsets,
                'repeat_every_days' => $s->repeat_every_days,
                'is_active' => $s->is_active,
            ]);

        return ApiResponse::success([
            'schedules' => $schedules,
            'default' => self::DEFAULT,
        ], 'Calendriers de fidélisation.');
    }

    public function upsert(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'offsets' => ['required', 'array', 'min:1'],
            'offsets.*' => ['integer', 'min:0', 'max:3650'],
            'repeat_every_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $offsets = array_values(array_unique(array_map('intval', $data['offsets'])));
        sort($offsets);

        $schedule = FollowUpSchedule::query()->updateOrCreate(
            ['brand_id' => $brandId, 'product_id' => $data['product_id'] ?? null],
            [
                'offsets' => $offsets,
                'repeat_every_days' => $data['repeat_every_days'] ?? null,
                'is_active' => $data['is_active'] ?? true,
                'updated_by' => $request->user()?->id,
                'created_by' => $request->user()?->id,
            ],
        );

        AuditLogger::log($request, 'follow_up_schedule.upsert', $schedule, null, $schedule->toArray());

        return ApiResponse::success($schedule, 'Calendrier enregistré.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $schedule = FollowUpSchedule::query()->where('brand_id', $brandId)->findOrFail($id);
        $schedule->delete();

        AuditLogger::log($request, 'follow_up_schedule.delete', null, ['id' => (int) $id], null);

        return ApiResponse::success(null, 'Calendrier supprimé.');
    }
}
