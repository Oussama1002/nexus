<?php

namespace Database\Factories;

use App\Models\Brand;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class StudentFactory extends Factory
{
    protected $model = Student::class;

    public function definition(): array
    {
        return [
            'brand_id' => Brand::factory(),
            'user_id' => User::factory(),
            'full_name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => fake()->phoneNumber(),
            'company' => fake()->company(),
            'position' => fake()->jobTitle(),
            'avatar_url' => null,
            'last_activity_at' => now(),
            'status' => 'active',
        ];
    }
}
