<?php

namespace App\Services\Meta;

use App\Models\SmmContent;
use App\Models\SmmContentPerformance;
use App\Models\SmmPerformanceSnapshot;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Fetches organic performance data for a published SMM content from
 * Meta Graph API (Instagram + Facebook) and upserts SmmContentPerformance
 * plus a historical snapshot.
 *
 * Requires:
 *  - Meta credentials configured in SystemSetting per brand (see MetaAdsConfig).
 *  - The SmmContent must have status = 'publie', platform in ['instagram','facebook'],
 *    and published_platform_id set to the platform-native media/post id.
 */
class MetaContentInsightsService
{
    public function __construct(
        private readonly MetaGraphClient $graph,
        private readonly MetaAdsConfig $config,
    ) {}

    /**
     * Sync one content. Returns the fresh performance row, or null when
     * skipped (unsupported platform / not published / missing platform id).
     * Marks sync_failed=true on the performance row on any Graph error
     * and rethrows so the caller can decide whether to fan out notifications.
     */
    public function syncContent(SmmContent $content): ?SmmContentPerformance
    {
        if ($content->status !== 'publie') return null;
        if (! in_array($content->platform, ['instagram', 'facebook'], true)) return null;
        if (empty($content->published_platform_id)) return null;
        if (! $content->brand_id) return null;

        if (! $this->config->isComplete((int) $content->brand_id)) {
            // Credentials missing: mark failure but don't blow up the batch
            return $this->recordFailure($content, 'Identifiants Meta non configurés pour cette marque.');
        }

        try {
            $metrics = $content->platform === 'instagram'
                ? $this->fetchInstagram($content)
                : $this->fetchFacebook($content);
        } catch (MetaApiException $e) {
            return $this->recordFailure($content, $e->getMessage());
        } catch (Throwable $e) {
            Log::error('meta.insights.unexpected', [
                'content_id' => $content->id,
                'platform' => $content->platform,
                'error' => $e->getMessage(),
            ]);
            return $this->recordFailure($content, 'Erreur inattendue lors de la synchronisation Meta.');
        }

        $row = SmmContentPerformance::query()->updateOrCreate(
            ['content_id' => $content->id, 'platform' => $content->platform],
            array_merge($metrics, [
                'brand_id' => $content->brand_id,
                'last_synced_at' => now(),
                'sync_failed' => false,
                'sync_error' => null,
            ]),
        );

        SmmPerformanceSnapshot::query()->create([
            'content_id' => $content->id,
            'platform' => $content->platform,
            'snapshot_at' => now(),
            'metrics_json' => $metrics,
        ]);

        return $row->fresh();
    }

    /**
     * Instagram Graph API insights.
     * Supported metrics vary by media type; we fetch a safe superset and let
     * the API return only what's available.
     *
     * @return array<string, int|float>
     */
    private function fetchInstagram(SmmContent $content): array
    {
        // Metric list Meta accepts on IG media. Non-applicable metrics are dropped by Meta.
        $metric = implode(',', [
            'reach', 'impressions', 'likes', 'comments', 'shares', 'saved',
            'total_interactions', 'plays', 'video_views', 'profile_visits', 'follows',
            'website_clicks',
        ]);

        $payload = $this->graph->get(
            (int) $content->brand_id,
            $content->published_platform_id . '/insights',
            ['metric' => $metric],
        );

        $flat = $this->flattenInsightsResponse($payload);

        return [
            'reach' => (int) ($flat['reach'] ?? 0),
            'impressions' => (int) ($flat['impressions'] ?? 0),
            'views' => (int) ($flat['plays'] ?? $flat['video_views'] ?? $flat['impressions'] ?? 0),
            'shares' => (int) ($flat['shares'] ?? 0),
            'saves' => (int) ($flat['saved'] ?? 0),
            'comments_count' => (int) ($flat['comments'] ?? 0),
            'profile_visits' => (int) ($flat['profile_visits'] ?? 0),
            'followers_gained' => (int) ($flat['follows'] ?? 0),
            'clicks' => (int) ($flat['website_clicks'] ?? 0),
            'conversions' => 0, // organic Meta does not expose this
            'engagement_rate' => $this->computeEngagementRate(
                likes: (int) ($flat['likes'] ?? 0),
                comments: (int) ($flat['comments'] ?? 0),
                shares: (int) ($flat['shares'] ?? 0),
                saves: (int) ($flat['saved'] ?? 0),
                reach: (int) ($flat['reach'] ?? 0),
            ),
        ];
    }

    /**
     * Facebook Page post insights.
     *
     * @return array<string, int|float>
     */
    private function fetchFacebook(SmmContent $content): array
    {
        $metric = implode(',', [
            'post_impressions', 'post_impressions_unique',
            'post_engaged_users', 'post_clicks',
            'post_reactions_by_type_total',
            'post_video_views',
        ]);

        $payload = $this->graph->get(
            (int) $content->brand_id,
            $content->published_platform_id . '/insights',
            ['metric' => $metric],
        );

        $flat = $this->flattenInsightsResponse($payload);
        $reactions = $flat['post_reactions_by_type_total'] ?? [];
        $likes = is_array($reactions) ? array_sum(array_map('intval', $reactions)) : 0;

        return [
            'reach' => (int) ($flat['post_impressions_unique'] ?? 0),
            'impressions' => (int) ($flat['post_impressions'] ?? 0),
            'views' => (int) ($flat['post_video_views'] ?? $flat['post_impressions'] ?? 0),
            'shares' => 0, // FB deprecated public share count on post insights
            'saves' => 0,
            'comments_count' => 0, // fetch separately via edge if needed
            'profile_visits' => 0,
            'followers_gained' => 0,
            'clicks' => (int) ($flat['post_clicks'] ?? 0),
            'conversions' => 0,
            'engagement_rate' => $this->computeEngagementRate(
                likes: $likes,
                comments: 0,
                shares: 0,
                saves: 0,
                reach: (int) ($flat['post_impressions_unique'] ?? 0),
            ),
        ];
    }

    /**
     * Meta insights come as {"data": [{"name":"reach", "values":[{"value": 1234}]}, ...]}.
     * Flatten to a name → value map.
     *
     * @param array<string,mixed> $payload
     * @return array<string, mixed>
     */
    private function flattenInsightsResponse(array $payload): array
    {
        $out = [];
        foreach (($payload['data'] ?? []) as $item) {
            if (! is_array($item) || empty($item['name'])) continue;
            $values = $item['values'] ?? [];
            $first = is_array($values) ? ($values[0] ?? null) : null;
            $out[$item['name']] = is_array($first) ? ($first['value'] ?? 0) : 0;
        }
        return $out;
    }

    private function computeEngagementRate(int $likes, int $comments, int $shares, int $saves, int $reach): float
    {
        if ($reach <= 0) return 0.0;
        return round((($likes + $comments + $shares + $saves) / $reach) * 100, 3);
    }

    private function recordFailure(SmmContent $content, string $message): SmmContentPerformance
    {
        $row = SmmContentPerformance::query()->updateOrCreate(
            ['content_id' => $content->id, 'platform' => $content->platform],
            [
                'brand_id' => $content->brand_id,
                'last_synced_at' => now(),
                'sync_failed' => true,
                'sync_error' => $message,
            ],
        );

        Log::warning('meta.insights.failed', [
            'content_id' => $content->id,
            'platform' => $content->platform,
            'error' => $message,
        ]);

        return $row->fresh();
    }
}
