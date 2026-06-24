<?php

namespace Database\Factories;

use App\Models\Quiz;
use App\Models\QuizQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuizQuestionFactory extends Factory
{
    protected $model = QuizQuestion::class;

    public function definition(): array
    {
        return [
            'quiz_id' => Quiz::factory(),
            'question_type' => fake()->randomElement(['multiple_choice', 'multiple_answers', 'true_false', 'short_answer']),
            'question_text' => fake()->sentence(),
            'points' => fake()->numberBetween(1, 5),
            'sort_order' => fake()->numberBetween(1, 20),
            'is_required' => true,
        ];
    }
}
