<?php

namespace App\Models;

class Trainer extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'brand_id',
        'user_id',
        'full_name',
        'email',
        'phone',
        'headline',
        'bio',
        'expertise',
        'avatar_url',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'expertise' => 'array',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function liveSessions()
    {
        return $this->hasMany(LiveSession::class);
    }
}
