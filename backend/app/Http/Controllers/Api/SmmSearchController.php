<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmAutomation;
use App\Models\SmmClientInsight;
use App\Models\SmmContent;
use App\Models\SmmEvent;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Global free-text search across the SMM domain (spec §14).
 * Returns hits from four collections in a single call: contents, events,
 * automations, insights (verbatims). Each hit shares a common envelope so
 * the frontend can render a mixed list.
 */
class SmmSearchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $q = trim((string) $request->query('q', ''));
        $limit = min(max((int) $request->query('limit', 10), 1), 50);

        if ($q === '') {
            return ApiResponse::success([
                'contents' => [],
                'events' => [],
                'automations' => [],
                'insights' => [],
                'total' => 0,
            ]);
        }

        $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';

        $contents = SmmContent::query()
            ->when($brandId, fn ($qq) => $qq->where('brand_id', $brandId))
            ->where(function ($w) use ($like) {
                $w->where('title', 'like', $like)
                    ->orWhere('concept', 'like', $like)
                    ->orWhere('file_identifier', 'like', $like);
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'title', 'platform', 'format', 'status', 'scheduled_publish_at', 'brand_id'])
            ->map(fn ($c) => [
                'type' => 'content',
                'id' => $c->id,
                'label' => $c->title,
                'sub' => "{$c->platform} · {$c->format} · {$c->status}",
                'when' => $c->scheduled_publish_at?->toIso8601String(),
            ]);

        $events = SmmEvent::query()
            ->when($brandId, fn ($qq) => $qq->where('brand_id', $brandId))
            ->where('label', 'like', $like)
            ->orderByDesc('start_date')
            ->limit($limit)
            ->get(['id', 'label', 'event_type', 'amplitude', 'status', 'start_date', 'brand_id'])
            ->map(fn ($e) => [
                'type' => 'event',
                'id' => $e->id,
                'label' => $e->label,
                'sub' => "{$e->event_type} · " . ($e->amplitude ?? '—') . " · {$e->status}",
                'when' => $e->start_date?->toDateString(),
            ]);

        $automations = SmmAutomation::query()
            ->when($brandId, fn ($qq) => $qq->where('brand_id', $brandId))
            ->where('label', 'like', $like)
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'label', 'platform', 'trigger_type', 'status', 'brand_id'])
            ->map(fn ($a) => [
                'type' => 'automation',
                'id' => $a->id,
                'label' => $a->label,
                'sub' => "{$a->platform} · {$a->trigger_type} · {$a->status}",
                'when' => null,
            ]);

        $insights = SmmClientInsight::query()
            ->when($brandId, fn ($qq) => $qq->where('brand_id', $brandId))
            ->where('verbatim', 'like', $like)
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'verbatim', 'source', 'insight_type', 'status', 'captured_on', 'brand_id'])
            ->map(fn ($i) => [
                'type' => 'insight',
                'id' => $i->id,
                'label' => \Illuminate\Support\Str::limit((string) $i->verbatim, 80),
                'sub' => "{$i->source} · {$i->insight_type} · {$i->status}",
                'when' => $i->captured_on?->toDateString(),
            ]);

        $total = $contents->count() + $events->count() + $automations->count() + $insights->count();

        return ApiResponse::success([
            'contents' => $contents->values(),
            'events' => $events->values(),
            'automations' => $automations->values(),
            'insights' => $insights->values(),
            'total' => $total,
            'query' => $q,
        ]);
    }
}
