<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\CourseLesson;
use App\Models\CourseSection;
use Illuminate\Database\Eloquent\Factories\Factory;

class CourseLessonFactory extends Factory
{
    protected $model = CourseLesson::class;

    public function definition(): array
    {
        $type = fake()->randomElement(['video', 'pdf', 'text', 'external_link']);

        return [
            'course_id' => Course::factory(),
            'course_section_id' => CourseSection::factory(),
            'title' => fake()->sentence(4),
            'lesson_type' => $type,
            'content' => $type === 'text' ? fake()->paragraphs(2, true) : null,
            'video_url' => $type === 'video' ? fake()->url() : null,
            'pdf_url' => $type === 'pdf' ? fake()->url() : null,
            'external_url' => $type === 'external_link' ? fake()->url() : null,
            'duration_minutes' => fake()->numberBetween(5, 45),
            'sort_order' => fake()->numberBetween(1, 20),
            'is_preview' => false,
            'is_published' => true,
        ];
    }
}
