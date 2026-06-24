<?php

namespace Database\Factories;

use App\Models\QuizAnswer;
use App\Models\QuizQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuizAnswerFactory extends Factory
{
    protected $model = QuizAnswer::class;

    public function definition(): array
    {
        return [
            'quiz_question_id' => QuizQuestion::factory(),
            'answer_text' => fake()->sentence(3),
            'is_correct' => false,
            'sort_order' => fake()->numberBetween(1, 6),
        ];
    }
}
