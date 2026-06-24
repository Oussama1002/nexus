<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\CourseReview;
use App\Models\Enrollment;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

class CourseReviewFactory extends Factory
{
    protected $model = CourseReview::class;

    public function definition(): array
    {
        return [
            'course_id' => Course::factory(),
            'student_id' => Student::factory(),
            'enrollment_id' => Enrollment::factory(),
            'rating' => fake()->numberBetween(3, 5),
            'review' => fake()->sentence(),
            'status' => 'pending',
        ];
    }
}
