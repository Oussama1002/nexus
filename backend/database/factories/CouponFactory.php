<?php

namespace Database\Factories;

use App\Models\Brand;
use App\Models\Coupon;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class CouponFactory extends Factory
{
    protected $model = Coupon::class;

    public function definition(): array
    {
        return [
            'brand_id' => Brand::factory(),
            'code' => strtoupper(Str::random(8)),
            'type' => 'percent',
            'value' => fake()->numberBetween(5, 30),
            'max_redemptions' => 100,
            'used_redemptions' => 0,
            'starts_at' => now()->subDay(),
            'expires_at' => now()->addMonth(),
            'is_active' => true,
        ];
    }
}
