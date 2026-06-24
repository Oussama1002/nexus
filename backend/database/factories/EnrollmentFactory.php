<?php

namespace Database\Factories;

use App\Models\Brand;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

class EnrollmentFactory extends Factory
{
    protected $model = Enrollment::class;

    public function definition(): array
    {
        return [
            'brand_id' => Brand::factory(),
            'course_id' => Course::factory(),
            'student_id' => Student::factory(),
            'status' => 'active',
            'enrollment_type' => 'free',
            'price_paid' => 0,
            'currency' => 'USD',
            'progress_percent' => fake()->numberBetween(0, 100),
            'enrolled_at' => now(),
        ];
    }
}
