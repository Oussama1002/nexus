<?php

namespace Database\Factories;

use App\Models\Brand;
use App\Models\Trainer;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class TrainerFactory extends Factory
{
    protected $model = Trainer::class;

    public function definition(): array
    {
        return [
            'brand_id' => Brand::factory(),
            'user_id' => User::factory(),
            'full_name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'phone' => fake()->phoneNumber(),
            'headline' => fake()->jobTitle(),
            'bio' => fake()->paragraph(),
            'expertise' => [fake()->word(), fake()->word()],
            'avatar_url' => null,
            'status' => 'active',
        ];
    }
}
