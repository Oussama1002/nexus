<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\LiveSession;
use App\Models\Trainer;
use Illuminate\Database\Eloquent\Factories\Factory;

class LiveSessionFactory extends Factory
{
    protected $model = LiveSession::class;

    public function definition(): array
    {
        return [
            'course_id' => Course::factory(),
            'trainer_id' => Trainer::factory(),
            'session_title' => fake()->sentence(4),
            'meeting_url' => fake()->url(),
            'starts_at' => now()->addDays(3),
            'duration_minutes' => 90,
            'attendance_count' => 0,
            'status' => 'scheduled',
            'recording_url' => null,
        ];
    }
}
