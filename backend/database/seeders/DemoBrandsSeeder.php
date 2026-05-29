<?php

namespace Database\Seeders;

use App\Models\Brand;
use Illuminate\Database\Seeder;

class DemoBrandsSeeder extends Seeder
{
    public function run(): void
    {
        $brands = [
            ['name' => 'Luxe Cosmetics', 'code' => 'LUXE01', 'whatsapp_number' => '+212661234567'],
            ['name' => 'Zest Home', 'code' => 'ZEST01', 'whatsapp_number' => '+212661765432'],
            ['name' => 'Moda Casa', 'code' => 'MODA01', 'whatsapp_number' => '+212661112233'],
        ];

        foreach ($brands as $brand) {
            Brand::updateOrCreate(
                ['code' => $brand['code']],
                [
                    'name' => $brand['name'],
                    'logo_url' => null,
                    'color' => null,
                    'whatsapp_number' => $brand['whatsapp_number'],
                    'status' => 'active',
                ]
            );
        }
    }
}
