<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AcademyContent extends Model
{
    use HasFactory;

    protected $table = 'academy_contents';

    protected $fillable = [
        'brand_id', 'learning_path_id', 'title', 'type', 'description',
        'media_url', 'duration_minutes', 'author_user_id',
        'views_count', 'rating', 'status',
    ];

    protected $casts = [
        'duration_minutes' => 'integer',
        'views_count' => 'integer',
        'rating' => 'decimal:2',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function learningPath() { return $this->belongsTo(AcademyLearningPath::class, 'learning_path_id'); }
    public function author() { return $this->belongsTo(User::class, 'author_user_id'); }
}
