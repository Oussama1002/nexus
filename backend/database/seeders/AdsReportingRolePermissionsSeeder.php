<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class AdsReportingRolePermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $bySlug = fn (array $slugs) => Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();

        $adsModules = [
            'campaigns.view', 'campaigns.create', 'campaigns.update', 'campaigns.delete',
            'ad_accounts.view', 'ad_accounts.create', 'ad_accounts.update', 'ad_accounts.delete',
            'campaign_metrics.view', 'campaign_metrics.create', 'campaign_metrics.update', 'campaign_metrics.delete',
            'reports.view',
        ];

        $mediaBuyerExtras = ['users.view', 'products.view', 'influence.view'];

        $media = Role::query()->where('slug', 'media_buyer')->first();
        if ($media) {
            $media->permissions()->syncWithoutDetaching($bySlug(array_merge($adsModules, $mediaBuyerExtras)));
        }

        $manager = Role::query()->where('slug', 'manager_operationnel')->first();
        if ($manager) {
            $manager->permissions()->syncWithoutDetaching($bySlug($adsModules));
        }

        $cm = Role::query()->where('slug', 'community_manager')->first();
        if ($cm) {
            $cm->permissions()->syncWithoutDetaching($bySlug([
                'campaigns.view',
                'ad_accounts.view',
                'reports.view',
            ]));
        }

        $smm = Role::query()->where('slug', 'smm')->first();
        if ($smm) {
            $smm->permissions()->syncWithoutDetaching($bySlug([
                'campaigns.view',
                'ad_accounts.view',
                'reports.view',
            ]));
        }
    }
}
