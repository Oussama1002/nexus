<?php

namespace Database\Factories;

use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuizAttemptFactory extends Factory
{
    protected $model = QuizAttempt::class;

    public function definition(): array
    {
        return [
            'quiz_id' => Quiz::factory(),
            'enrollment_id' => Enrollment::factory(),
            'student_id' => Student::factory(),
            'status' => 'submitted',
            'score' => fake()->numberBetween(0, 100),
            'time_spent_seconds' => fake()->numberBetween(60, 1800),
            'passed' => fake()->boolean(),
            'started_at' => now()->subMinutes(40),
            'submitted_at' => now()->subMinutes(10),
        ];
    }
}
