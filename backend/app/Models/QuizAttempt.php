<?php

namespace App\Models;

class QuizAttempt extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'quiz_id',
        'enrollment_id',
        'student_id',
        'status',
        'score',
        'time_spent_seconds',
        'passed',
        'started_at',
        'submitted_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'passed' => 'boolean',
        'started_at' => 'datetime',
        'submitted_at' => 'datetime',
    ];

    public function quiz()
    {
        return $this->belongsTo(Quiz::class);
    }

    public function enrollment()
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function results()
    {
        return $this->hasMany(QuizAttemptResult::class);
    }
}
