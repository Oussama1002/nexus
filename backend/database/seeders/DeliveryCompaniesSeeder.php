<?php

namespace Database\Seeders;

use App\Models\DeliveryCompany;
use Illuminate\Database\Seeder;

class DeliveryCompaniesSeeder extends Seeder
{
    public function run(): void
    {
        DeliveryCompany::query()->updateOrCreate(
            ['code' => 'sendit'],
            [
                'name' => 'Sendit',
                'api_url' => (string) config('delivery.sendit.api_url'),
                'tracking_base_url' => 'https://app.sendit.ma',
                'avg_delivery_days' => 2,
                'status' => 'active',
            ]
        );

        DeliveryCompany::query()->updateOrCreate(
            ['code' => 'ameex'],
            [
                'name' => 'Ameex',
                'api_url' => (string) config('delivery.ameex.api_url'),
                'tracking_base_url' => 'https://www.ameex.ma/en/delivery',
                'avg_delivery_days' => 3,
                'status' => 'active',
            ]
        );
    }
}
