<?php

namespace Database\Factories;

use App\Models\CourseLesson;
use App\Models\Enrollment;
use App\Models\LessonProgress;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

class LessonProgressFactory extends Factory
{
    protected $model = LessonProgress::class;

    public function definition(): array
    {
        return [
            'enrollment_id' => Enrollment::factory(),
            'student_id' => Student::factory(),
            'course_lesson_id' => CourseLesson::factory(),
            'status' => fake()->randomElement(['viewed', 'completed']),
            'time_spent_seconds' => fake()->numberBetween(20, 2000),
            'last_position_seconds' => fake()->numberBetween(10, 400),
            'viewed_at' => now(),
            'completed_at' => fake()->optional()->dateTime(),
        ];
    }
}
