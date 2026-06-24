<?php

namespace App\Models;

class Course extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'brand_id',
        'course_category_id',
        'certificate_template_id',
        'title',
        'slug',
        'short_description',
        'description',
        'status',
        'enrollment_type',
        'price',
        'currency',
        'thumbnail_url',
        'cover_image_url',
        'duration_minutes',
        'difficulty_level',
        'learning_objectives',
        'prerequisites',
        'seo_title',
        'seo_description',
        'seo_keywords',
        'published_at',
        'is_featured',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'learning_objectives' => 'array',
        'prerequisites' => 'array',
        'seo_keywords' => 'array',
        'published_at' => 'datetime',
        'is_featured' => 'boolean',
        'price' => 'decimal:2',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function category()
    {
        return $this->belongsTo(CourseCategory::class, 'course_category_id');
    }

    public function certificateTemplate()
    {
        return $this->belongsTo(CertificateTemplate::class);
    }

    public function sections()
    {
        return $this->hasMany(CourseSection::class);
    }

    public function lessons()
    {
        return $this->hasMany(CourseLesson::class);
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class);
    }

    public function quizzes()
    {
        return $this->hasMany(Quiz::class);
    }

    public function reviews()
    {
        return $this->hasMany(CourseReview::class);
    }

    public function announcements()
    {
        return $this->hasMany(CourseAnnouncement::class);
    }

    public function liveSessions()
    {
        return $this->hasMany(LiveSession::class);
    }
}
