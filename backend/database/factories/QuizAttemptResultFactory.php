<?php

namespace Database\Factories;

use App\Models\QuizAnswer;
use App\Models\QuizAttempt;
use App\Models\QuizAttemptResult;
use App\Models\QuizQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuizAttemptResultFactory extends Factory
{
    protected $model = QuizAttemptResult::class;

    public function definition(): array
    {
        return [
            'quiz_attempt_id' => QuizAttempt::factory(),
            'quiz_question_id' => QuizQuestion::factory(),
            'quiz_answer_id' => QuizAnswer::factory(),
            'answer_text' => fake()->sentence(),
            'is_correct' => fake()->boolean(),
            'points_awarded' => fake()->numberBetween(0, 3),
        ];
    }
}
