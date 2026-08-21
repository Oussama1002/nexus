<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AcademyLearningPathEnrollment extends Model
{
    use HasFactory;

    protected $table = 'academy_learning_path_enrollments';

    protected $fillable = [
        'learning_path_id', 'user_id',
        'enrolled_at', 'completed_at', 'progress_pct',
    ];

    protected $casts = [
        'enrolled_at' => 'datetime',
        'completed_at' => 'datetime',
        'progress_pct' => 'integer',
    ];

    public function learningPath() { return $this->belongsTo(AcademyLearningPath::class, 'learning_path_id'); }
    public function user() { return $this->belongsTo(User::class); }
}
