<?php

namespace App\Models;

class CourseReview extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'course_id',
        'student_id',
        'enrollment_id',
        'rating',
        'review',
        'status',
        'moderated_by',
        'moderated_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'moderated_at' => 'datetime',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function enrollment()
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function moderator()
    {
        return $this->belongsTo(User::class, 'moderated_by');
    }
}
