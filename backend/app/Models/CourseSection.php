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
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_published' => 'boolean',
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
