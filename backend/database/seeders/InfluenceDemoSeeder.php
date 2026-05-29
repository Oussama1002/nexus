<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Influencer;
use App\Models\InfluencerCollaboration;
use App\Models\InfluencerComplaint;
use App\Models\InfluencerMessage;
use App\Models\InfluencerPerformance;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

/**
 * Demo rows for Studio Influence lists + KPI dashboard (per demo brand).
 * Idempotent via deterministic usernames / titles.
 */
class InfluenceDemoSeeder extends Seeder
{
    public function run(): void
    {
        $brands = Brand::query()->whereIn('code', ['LUXE01', 'ZEST01', 'MODA01'])->orderBy('code')->get();
        if ($brands->isEmpty()) {
            return;
        }

        $today = Carbon::today();
        $metricDate = $today->copy()->subDay();

        foreach ($brands as $brand) {
            $code = (string) $brand->code;

            $infA = Influencer::query()->updateOrCreate(
                ['brand_id' => $brand->id, 'username' => "demo_{$code}_a"],
                [
                    'full_name' => "Influenceur démo A ({$code})",
                    'platform' => 'instagram',
                    'niche' => 'Lifestyle',
                    'audience_size' => 85000,
                    'engagement_rate' => 3.2,
                    'status' => 'active',
                ]
            );

            $infB = Influencer::query()->updateOrCreate(
                ['brand_id' => $brand->id, 'username' => "demo_{$code}_b"],
                [
                    'full_name' => "Influenceur démo B ({$code})",
                    'platform' => 'tiktok',
                    'niche' => 'DIY',
                    'audience_size' => 210000,
                    'engagement_rate' => 4.1,
                    'status' => 'active',
                ]
            );

            $collab = InfluencerCollaboration::query()->updateOrCreate(
                ['influencer_id' => $infA->id, 'title' => "Campagne démo {$code}"],
                [
                    'brand_id' => $brand->id,
                    'collaboration_type' => 'sponsored_post',
                    'status' => 'active',
                    'deliverables' => '1 reel + 3 stories',
                    'agreed_amount' => 4500,
                    'start_date' => $today->copy()->subDays(14),
                    'end_date' => $today->copy()->addDays(30),
                ]
            );

            InfluencerPerformance::query()->updateOrCreate(
                [
                    'influencer_id' => $infA->id,
                    'influencer_collaboration_id' => $collab->id,
                    'metric_date' => $metricDate->toDateString(),
                ],
                [
                    'views' => 120000,
                    'reach' => 95000,
                    'impressions' => 130000,
                    'likes' => 8200,
                    'comments' => 410,
                    'shares' => 120,
                    'clicks' => 900,
                    'revenue' => 12750.5,
                    'engagement_rate' => 3.4,
                    'roi_percent' => 183.5,
                ]
            );

            InfluencerPerformance::query()->updateOrCreate(
                [
                    'influencer_id' => $infB->id,
                    'influencer_collaboration_id' => null,
                    'metric_date' => $metricDate->toDateString(),
                ],
                [
                    'views' => 450000,
                    'reach' => 400000,
                    'revenue' => 5200,
                    'engagement_rate' => 5.1,
                    'roi_percent' => 95,
                ]
            );

            InfluencerMessage::query()->updateOrCreate(
                [
                    'influencer_id' => $infA->id,
                    'influencer_collaboration_id' => $collab->id,
                    'direction' => 'outbound',
                    'channel' => 'whatsapp',
                ],
                [
                    'message' => "Bonjour, voici le brief pour la campagne démo {$code} — merci de confirmer la date de post.",
                    'message_at' => $today->copy()->subHours(3),
                ]
            );

            InfluencerComplaint::query()->updateOrCreate(
                ['influencer_id' => $infB->id, 'title' => "Plainte démo livrable — {$code}"],
                [
                    'influencer_collaboration_id' => null,
                    'category' => 'delay',
                    'description' => 'Exemple de plainte ouverte pour les tests UI.',
                    'severity' => 'medium',
                    'status' => 'open',
                ]
            );
        }
    }
}
