<?php

namespace App\Models;

class LessonResource extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'course_lesson_id',
        'title',
        'resource_type',
        'resource_url',
        'file_path',
        'sort_order',
        'created_by',
        'updated_by',
    ];

    public function lesson()
    {
        return $this->belongsTo(CourseLesson::class, 'course_lesson_id');
    }
}
