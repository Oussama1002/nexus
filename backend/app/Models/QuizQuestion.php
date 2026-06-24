<?php

namespace App\Models;

class QuizQuestion extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'quiz_id',
        'question_type',
        'question_text',
        'points',
        'sort_order',
        'is_required',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_required' => 'boolean',
    ];

    public function quiz()
    {
        return $this->belongsTo(Quiz::class);
    }

    public function answers()
    {
        return $this->hasMany(QuizAnswer::class);
    }
}
