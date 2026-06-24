<?php

namespace App\Models;

class CourseLesson extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'course_id',
        'course_section_id',
        'title',
        'lesson_type',
        'content',
        'video_url',
        'pdf_url',
        'external_url',
        'duration_minutes',
        'sort_order',
        'is_preview',
        'is_published',
        'published_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_preview' => 'boolean',
        'is_published' => 'boolean',
        'published_at' => 'datetime',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function section()
    {
        return $this->belongsTo(CourseSection::class, 'course_section_id');
    }

    public function resources()
    {
        return $this->hasMany(LessonResource::class);
    }

    public function progress()
    {
        return $this->hasMany(LessonProgress::class);
    }
}
