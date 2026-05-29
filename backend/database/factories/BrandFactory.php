<?php

namespace Database\Factories;

use App\Models\Brand;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class BrandFactory extends Factory
{
    protected $model = Brand::class;

    public function definition(): array
    {
        $name = fake()->company();
        return [
            'name' => $name,
            'code' => strtoupper(Str::substr(Str::slug($name, ''), 0, 8)) . fake()->numberBetween(10, 99),
            'logo_url' => null,
            'color' => null,
            'whatsapp_number' => '+2126' . fake()->numerify('########'),
            'status' => 'active',
        ];
    }
}
