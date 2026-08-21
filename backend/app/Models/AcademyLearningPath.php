<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AcademyLearningPath extends Model
{
    use HasFactory;

    protected $table = 'academy_learning_paths';

    protected $fillable = [
        'brand_id', 'title', 'description', 'level',
        'duration_hours', 'status', 'created_by_user_id',
    ];

    protected $casts = [
        'duration_hours' => 'decimal:1',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by_user_id'); }
    public function contents() { return $this->hasMany(AcademyContent::class, 'learning_path_id'); }
    public function enrollments() { return $this->hasMany(AcademyLearningPathEnrollment::class, 'learning_path_id'); }
}
