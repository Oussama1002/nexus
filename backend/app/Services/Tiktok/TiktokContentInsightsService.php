<?php

namespace App\Services\Tiktok;

use App\Models\SmmContent;
use App\Models\SmmContentPerformance;
use App\Models\SmmPerformanceSnapshot;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Fetches organic performance data for a published SMM content whose
 * platform is 'tiktok', via the TikTok Business API (Video Insights).
 * Mirrors MetaContentInsightsService in shape and behaviour.
 *
 * Required per-brand SystemSetting keys:
 *  - tiktok_access_token       (long-lived business API token)
 *  - tiktok_business_id        (business account id — optional if the
 *                               token is already scoped to one account)
 *  - tiktok_api_version        (default 'v1.3')
 */
class TiktokContentInsightsService
{
    private const DEFAULT_VERSION = 'v1.3';
    private const BASE_URL = 'https://business-api.tiktok.com/open_api/';

    public function syncContent(SmmContent $content): ?SmmContentPerformance
    {
        if ($content->status !== 'publie') return null;
        if ($content->platform !== 'tiktok') return null;
        if (empty($content->published_platform_id)) return null;
        if (! $content->brand_id) return null;

        $cfg = $this->configForBrand((int) $content->brand_id);
        if ($cfg['access_token'] === '') {
            return $this->recordFailure($content, 'Identifiants TikTok non configurés pour cette marque.');
        }

        try {
            $metrics = $this->fetchVideoInsights($content, $cfg);
        } catch (Throwable $e) {
            return $this->recordFailure($content, $e->getMessage());
        }

        $row = SmmContentPerformance::query()->updateOrCreate(
            ['content_id' => $content->id, 'platform' => 'tiktok'],
            array_merge($metrics, [
                'brand_id' => $content->brand_id,
                'last_synced_at' => now(),
                'sync_failed' => false,
                'sync_error' => null,
            ]),
        );

        SmmPerformanceSnapshot::query()->create([
            'content_id' => $content->id,
            'platform' => 'tiktok',
            'snapshot_at' => now(),
            'metrics_json' => $metrics,
        ]);

        return $row->fresh();
    }

    /**
     * @return array<string, int|float>
     */
    private function fetchVideoInsights(SmmContent $content, array $cfg): array
    {
        // TikTok Business API — video/list or video/insight endpoint depending
        // on token scope. We use video/insight per-video by item_id.
        $url = rtrim(self::BASE_URL, '/') . '/' . $cfg['version'] . '/business/video/insight/';

        $response = Http::timeout(30)
            ->withHeaders(['Access-Token' => $cfg['access_token']])
            ->acceptJson()
            ->get($url, [
                'business_id' => $cfg['business_id'] ?: null,
                'video_ids' => [$content->published_platform_id],
                'fields' => 'video_views,likes,comments,shares,reach,average_time_watched,total_time_watched,full_video_watched_rate,profile_visits,followers_gained,clicks',
            ]);

        if (! $response->successful()) {
            $body = $response->json();
            $msg = is_array($body) ? ($body['message'] ?? $response->body()) : $response->body();
            Log::warning('tiktok.insights.error', ['content_id' => $content->id, 'status' => $response->status(), 'message' => $msg]);
            throw new \RuntimeException('Erreur TikTok API : ' . (is_string($msg) ? $msg : 'inconnue'));
        }

        $data = $response->json();
        $item = $data['data']['list'][0] ?? [];

        $views = (int) ($item['video_views'] ?? 0);
        $likes = (int) ($item['likes'] ?? 0);
        $comments = (int) ($item['comments'] ?? 0);
        $shares = (int) ($item['shares'] ?? 0);
        $reach = (int) ($item['reach'] ?? $views);

        return [
            'reach' => $reach,
            'impressions' => $views,
            'views' => $views,
            'shares' => $shares,
            'saves' => 0, // TikTok doesn't expose saves in this endpoint
            'comments_count' => $comments,
            'profile_visits' => (int) ($item['profile_visits'] ?? 0),
            'followers_gained' => (int) ($item['followers_gained'] ?? 0),
            'clicks' => (int) ($item['clicks'] ?? 0),
            'conversions' => 0,
            'engagement_rate' => $reach > 0
                ? round((($likes + $comments + $shares) / $reach) * 100, 3)
                : 0.0,
        ];
    }

    private function configForBrand(int $brandId): array
    {
        $rows = SystemSetting::query()
            ->where('brand_id', $brandId)
            ->whereIn('setting_key', ['tiktok_access_token', 'tiktok_business_id', 'tiktok_api_version'])
            ->pluck('setting_value', 'setting_key')->all();

        $token = trim((string) ($rows['tiktok_access_token'] ?? ''));
        if ($token === '' || preg_match('/^\*+$/', $token)) $token = '';

        return [
            'access_token' => $token,
            'business_id' => trim((string) ($rows['tiktok_business_id'] ?? '')),
            'version' => trim((string) ($rows['tiktok_api_version'] ?? self::DEFAULT_VERSION)) ?: self::DEFAULT_VERSION,
        ];
    }

    private function recordFailure(SmmContent $content, string $message): SmmContentPerformance
    {
        $row = SmmContentPerformance::query()->updateOrCreate(
            ['content_id' => $content->id, 'platform' => 'tiktok'],
            [
                'brand_id' => $content->brand_id,
                'last_synced_at' => now(),
                'sync_failed' => true,
                'sync_error' => $message,
            ],
        );

        Log::warning('tiktok.insights.failed', [
            'content_id' => $content->id,
            'error' => $message,
        ]);

        return $row->fresh();
    }
}
