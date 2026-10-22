<?php

namespace App\Models;

class CourseSection extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'course_id',
        'title',
        'description',
        'sort_order',
        'is_published',
        'starts_at',
        'ends_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function lessons()
    {
        return $this->hasMany(CourseLesson::class);
    }
}
