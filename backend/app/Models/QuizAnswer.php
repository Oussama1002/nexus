<?php

namespace App\Models;

class QuizAnswer extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'quiz_question_id',
        'answer_text',
        'is_correct',
        'sort_order',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_correct' => 'boolean',
    ];

    public function question()
    {
        return $this->belongsTo(QuizQuestion::class, 'quiz_question_id');
    }
}
