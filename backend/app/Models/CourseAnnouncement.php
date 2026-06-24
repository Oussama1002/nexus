<?php

namespace App\Models;

class CourseAnnouncement extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'course_id',
        'title',
        'body',
        'publish_at',
        'is_pinned',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'publish_at' => 'datetime',
        'is_pinned' => 'boolean',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }
}
