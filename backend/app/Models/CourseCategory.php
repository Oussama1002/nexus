<?php

namespace App\Models;

class CourseCategory extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'brand_id',
        'name',
        'slug',
        'description',
        'sort_order',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function courses()
    {
        return $this->hasMany(Course::class);
    }
}
