<?php

namespace App\Models;

class AcademyNotification extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'brand_id',
        'user_id',
        'student_id',
        'type',
        'title',
        'message',
        'channel',
        'status',
        'payload',
        'scheduled_at',
        'sent_at',
        'read_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'payload' => 'array',
        'scheduled_at' => 'datetime',
        'sent_at' => 'datetime',
        'read_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }
}
