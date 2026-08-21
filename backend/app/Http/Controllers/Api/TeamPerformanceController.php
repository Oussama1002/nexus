<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TeamPerformanceController extends Controller
{
    /**
     * Aggregate order handling stats per user for the requested period.
     * Frontend contract: { id, name, avatar_url, role, orders_count, confirmed_count, rate, avg_time, score }
     */
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $period = $request->query('period', 'month');
        $search = $request->query('search');
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $page = max((int) $request->query('page', 1), 1);

        [$from, $to] = $this->periodRange($period);

        $q = DB::table('orders')
            ->join('users', 'users.id', '=', 'orders.assigned_user_id')
            ->whereNotNull('orders.assigned_user_id')
            ->whereBetween('orders.created_at', [$from, $to])
            ->when($brandId !== null, fn ($qq) => $qq->where('orders.brand_id', $brandId))
            ->when($search, fn ($qq, $s) => $qq->where('users.name', 'like', "%{$s}%"))
            ->select([
                'users.id as user_id',
                'users.name as name',
                DB::raw('COUNT(orders.id) as orders_count'),
                DB::raw("SUM(CASE WHEN orders.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count"),
                DB::raw('AVG(CASE WHEN orders.confirmed_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, orders.created_at, orders.confirmed_at) END) as avg_time_seconds'),
            ])
            ->groupBy('users.id', 'users.name');

        $all = $q->get();
        $total = $all->count();
        $paged = $all->slice(($page - 1) * $perPage, $perPage)->values();

        // Pull role labels lazily
        $userIds = $paged->pluck('user_id')->all();
        $roles = [];
        if ($userIds) {
            $roleRows = DB::table('user_roles')
                ->join('roles', 'roles.id', '=', 'user_roles.role_id')
                ->whereIn('user_roles.user_id', $userIds)
                ->select('user_roles.user_id', 'roles.slug')
                ->get();
            foreach ($roleRows as $r) {
                $roles[$r->user_id] = $roles[$r->user_id] ?? [];
                $roles[$r->user_id][] = $r->slug;
            }
        }

        $data = $paged->map(function ($u) use ($roles) {
            $orders = (int) $u->orders_count;
            $confirmed = (int) $u->confirmed_count;
            $rate = $orders > 0 ? round(($confirmed / $orders) * 100, 1) : 0.0;
            $avgSecs = $u->avg_time_seconds ? (int) $u->avg_time_seconds : null;
            return [
                'id' => $u->user_id,
                'name' => $u->name,
                'avatar_url' => null,
                'role' => implode(', ', $roles[$u->user_id] ?? []) ?: '—',
                'orders_count' => $orders,
                'confirmed_count' => $confirmed,
                'rate' => $rate,
                'avg_time' => $avgSecs ? $this->formatDuration($avgSecs) : '—',
                'score' => (int) round($rate),
            ];
        })->all();

        $lastPage = max((int) ceil($total / $perPage), 1);
        return ApiResponse::success([
            'data' => $data,
            'current_page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'last_page' => $lastPage,
        ]);
    }

    private function periodRange(string $period): array
    {
        return match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            'quarter' => [now()->startOfQuarter(), now()->endOfQuarter()],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };
    }

    private function formatDuration(int $secs): string
    {
        if ($secs < 60) return "{$secs} s";
        $m = intdiv($secs, 60);
        if ($m < 60) return "{$m} min";
        $h = intdiv($m, 60);
        $m = $m % 60;
        return "{$h}h {$m}min";
    }
}
