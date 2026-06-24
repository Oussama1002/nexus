<?php

namespace App\Models;

class LessonProgress extends AcademyModel
{
    protected $table = 'lesson_progress';

    protected $fillable = [
        'uuid',
        'enrollment_id',
        'student_id',
        'course_lesson_id',
        'status',
        'time_spent_seconds',
        'last_position_seconds',
        'viewed_at',
        'completed_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'viewed_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function enrollment()
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function lesson()
    {
        return $this->belongsTo(CourseLesson::class, 'course_lesson_id');
    }
}
