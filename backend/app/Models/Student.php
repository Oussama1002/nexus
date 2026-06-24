<?php

namespace App\Models;

class Student extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'brand_id',
        'user_id',
        'full_name',
        'email',
        'phone',
        'company',
        'position',
        'avatar_url',
        'last_activity_at',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'last_activity_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class);
    }

    public function quizAttempts()
    {
        return $this->hasMany(QuizAttempt::class);
    }

    public function certificates()
    {
        return $this->hasMany(Certificate::class);
    }
}
