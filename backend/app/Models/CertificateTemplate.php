<?php

namespace App\Models;

class CertificateTemplate extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'brand_id',
        'name',
        'html_template',
        'background_image_url',
        'signature_image_url',
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

    public function certificates()
    {
        return $this->hasMany(Certificate::class);
    }
}
