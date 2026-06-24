<?php

namespace App\Models;

class Coupon extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'brand_id',
        'applicable_course_id',
        'code',
        'type',
        'value',
        'max_redemptions',
        'used_redemptions',
        'starts_at',
        'expires_at',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'starts_at' => 'datetime',
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'applicable_course_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }
}
