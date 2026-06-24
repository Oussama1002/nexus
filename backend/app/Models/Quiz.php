<?php

namespace App\Models;

class Quiz extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'course_id',
        'course_section_id',
        'course_lesson_id',
        'title',
        'description',
        'passing_score',
        'time_limit_minutes',
        'max_attempts',
        'auto_correction',
        'randomized_questions',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'auto_correction' => 'boolean',
        'randomized_questions' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function section()
    {
        return $this->belongsTo(CourseSection::class, 'course_section_id');
    }

    public function lesson()
    {
        return $this->belongsTo(CourseLesson::class, 'course_lesson_id');
    }

    public function questions()
    {
        return $this->hasMany(QuizQuestion::class);
    }

    public function attempts()
    {
        return $this->hasMany(QuizAttempt::class);
    }
}
