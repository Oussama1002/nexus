<?php

namespace Database\Factories;

use App\Models\Brand;
use App\Models\Course;
use App\Models\CourseCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class CourseFactory extends Factory
{
    protected $model = Course::class;

    public function definition(): array
    {
        $title = fake()->sentence(4);

        return [
            'brand_id' => Brand::factory(),
            'course_category_id' => CourseCategory::factory(),
            'title' => $title,
            'slug' => Str::slug($title).'-'.fake()->numberBetween(10, 99),
            'short_description' => fake()->sentence(),
            'description' => fake()->paragraphs(2, true),
            'status' => 'draft',
            'enrollment_type' => 'free',
            'price' => 0,
            'currency' => 'USD',
            'duration_minutes' => fake()->numberBetween(30, 300),
            'difficulty_level' => fake()->randomElement(['beginner', 'intermediate', 'advanced']),
            'learning_objectives' => [fake()->sentence(), fake()->sentence()],
            'prerequisites' => [fake()->sentence()],
            'seo_title' => $title,
            'seo_description' => fake()->sentence(),
            'seo_keywords' => [fake()->word(), fake()->word()],
            'is_featured' => false,
        ];
    }
}
