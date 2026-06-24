<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\CourseAnnouncement;
use Illuminate\Database\Eloquent\Factories\Factory;

class CourseAnnouncementFactory extends Factory
{
    protected $model = CourseAnnouncement::class;

    public function definition(): array
    {
        return [
            'course_id' => Course::factory(),
            'title' => fake()->sentence(4),
            'body' => fake()->paragraph(),
            'publish_at' => now(),
            'is_pinned' => false,
        ];
    }
}
