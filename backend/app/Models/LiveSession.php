<?php

namespace App\Models;

class LiveSession extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'course_id',
        'trainer_id',
        'session_title',
        'meeting_url',
        'starts_at',
        'duration_minutes',
        'attendance_count',
        'status',
        'recording_url',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function trainer()
    {
        return $this->belongsTo(Trainer::class);
    }
}
