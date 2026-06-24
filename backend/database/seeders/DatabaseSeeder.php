<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesSeeder::class,
            PermissionsSeeder::class,
            RoleOperationsPermissionsSeeder::class,
            AdsReportingRolePermissionsSeeder::class,
            Lot8RolePermissionsSeeder::class,
            ManagementRolePermissionsSeeder::class,
            ClientPortalRolePermissionsSeeder::class,
            AcademyRolePermissionsSeeder::class,
            DemoBrandsSeeder::class,
            DeliveryCompaniesSeeder::class,
            InfluenceDemoSeeder::class,
            AcademyDemoSeeder::class,
            SystemSettingsSeeder::class,
            AdminUserSeeder::class,
        ]);
    }
}
