<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Social & influence permissions for CM / SMM / Manager / Influence manager.
 */
class Lot8RolePermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $bySlug = fn (array $slugs) => Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();

        $cmSlugs = [
            'social_accounts.view',
            'strategies.view',
            'content_calendar.view', 'content_calendar.create', 'content_calendar.update',
            'content_production.view', 'content_production.create', 'content_production.update',
            'cm_tracking.view', 'cm_tracking.create', 'cm_tracking.update',
            'social_publications.view', 'social_publications.create', 'social_publications.update',
            'dashboard.view',
            'automations.view', 'automations.run',
            'collab_projects.view', 'collab_projects.create', 'collab_projects.update',
        ];

        $smmSlugs = array_merge($cmSlugs, [
            'social_accounts.create', 'social_accounts.update', 'social_accounts.delete',
            'strategies.create', 'strategies.update', 'strategies.delete', 'strategies.approve',
            'content_calendar.delete', 'content_calendar.approve',
            'content_production.delete', 'content_production.approve',
            'cm_tracking.approve',
            'social_publications.delete',
            'influence.view', 'influencer_performance.view',
            'reports.view',
            'automations.create', 'automations.update',
            'collab_projects.view', 'collab_projects.create', 'collab_projects.update', 'collab_projects.delete',
        ]);

        $influenceSlugs = [
            'influence.view', 'influence.create', 'influence.update', 'influence.delete', 'influence.manage',
            'influencer_collaborations.view', 'influencer_collaborations.create', 'influencer_collaborations.update', 'influencer_collaborations.delete',
            'influencer_performance.view', 'influencer_performance.create', 'influencer_performance.update', 'influencer_performance.delete',
            'influencer_messages.view', 'influencer_messages.create', 'influencer_messages.update', 'influencer_messages.delete',
            'influencer_complaints.view', 'influencer_complaints.create', 'influencer_complaints.update', 'influencer_complaints.delete',
            'dashboard.view',
            'reports.view',
            'automations.view', 'automations.run', 'automations.create', 'automations.update',
            'collab_projects.view', 'collab_projects.create', 'collab_projects.update',
        ];

        $managerViewSlugs = [
            'social_accounts.view',
            'strategies.view',
            'content_calendar.view',
            'content_production.view',
            'cm_tracking.view',
            'social_publications.view',
            'influence.view', 'influencer_collaborations.view', 'influencer_performance.view',
            'influencer_messages.view', 'influencer_complaints.view',
            'dashboard.view', 'reports.view',
            'automations.view', 'automations.run',
            'collab_projects.view',
        ];

        foreach ([
            ['slug' => 'community_manager', 'perms' => $cmSlugs],
            ['slug' => 'smm', 'perms' => $smmSlugs],
            ['slug' => 'influence_manager', 'perms' => array_unique(array_merge($influenceSlugs, [
                'social_accounts.view', 'content_calendar.view', 'strategies.view',
            ]))],
            ['slug' => 'manager_operationnel', 'perms' => $managerViewSlugs],
        ] as $row) {
            $role = Role::query()->where('slug', $row['slug'])->first();
            if ($role) {
                $role->permissions()->syncWithoutDetaching($bySlug($row['perms']));
            }
        }
    }
}
