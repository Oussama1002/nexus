<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\Quiz;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuizFactory extends Factory
{
    protected $model = Quiz::class;

    public function definition(): array
    {
        return [
            'course_id' => Course::factory(),
            'title' => fake()->sentence(3),
            'description' => fake()->sentence(),
            'passing_score' => 70,
            'time_limit_minutes' => 30,
            'max_attempts' => 3,
            'auto_correction' => true,
            'randomized_questions' => false,
            'is_active' => true,
        ];
    }
}
