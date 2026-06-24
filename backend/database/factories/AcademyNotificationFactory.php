<?php

namespace Database\Factories;

use App\Models\AcademyNotification;
use App\Models\Brand;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

class AcademyNotificationFactory extends Factory
{
    protected $model = AcademyNotification::class;

    public function definition(): array
    {
        return [
            'brand_id' => Brand::factory(),
            'student_id' => Student::factory(),
            'type' => fake()->randomElement(['enrollment_confirmation', 'course_completion', 'new_lesson']),
            'title' => fake()->sentence(4),
            'message' => fake()->sentence(),
            'channel' => fake()->randomElement(['email', 'in_app']),
            'status' => 'queued',
            'payload' => ['source' => 'factory'],
            'scheduled_at' => now()->addHour(),
        ];
    }
}
