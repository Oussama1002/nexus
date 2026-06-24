<?php

namespace App\Models;

class Enrollment extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'brand_id',
        'course_id',
        'student_id',
        'sales_agent_id',
        'status',
        'enrollment_type',
        'price_paid',
        'currency',
        'progress_percent',
        'enrolled_at',
        'expires_at',
        'completed_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'price_paid' => 'decimal:2',
        'enrolled_at' => 'datetime',
        'expires_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function salesAgent()
    {
        return $this->belongsTo(User::class, 'sales_agent_id');
    }

    public function lessonProgress()
    {
        return $this->hasMany(LessonProgress::class);
    }

    public function quizAttempts()
    {
        return $this->hasMany(QuizAttempt::class);
    }

    public function certificate()
    {
        return $this->hasOne(Certificate::class);
    }
}
