<?php

namespace Database\Factories;

use App\Models\CourseLesson;
use App\Models\LessonResource;
use Illuminate\Database\Eloquent\Factories\Factory;

class LessonResourceFactory extends Factory
{
    protected $model = LessonResource::class;

    public function definition(): array
    {
        return [
            'course_lesson_id' => CourseLesson::factory(),
            'title' => fake()->sentence(3),
            'resource_type' => fake()->randomElement(['file', 'link']),
            'resource_url' => fake()->url(),
            'file_path' => null,
            'sort_order' => fake()->numberBetween(1, 5),
        ];
    }
}
