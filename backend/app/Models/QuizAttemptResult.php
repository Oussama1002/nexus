<?php

namespace App\Models;

class QuizAttemptResult extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'quiz_attempt_id',
        'quiz_question_id',
        'quiz_answer_id',
        'answer_text',
        'is_correct',
        'points_awarded',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_correct' => 'boolean',
    ];

    public function attempt()
    {
        return $this->belongsTo(QuizAttempt::class, 'quiz_attempt_id');
    }

    public function question()
    {
        return $this->belongsTo(QuizQuestion::class, 'quiz_question_id');
    }

    public function answer()
    {
        return $this->belongsTo(QuizAnswer::class, 'quiz_answer_id');
    }
}
