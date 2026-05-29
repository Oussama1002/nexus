<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CmDailyTracking extends Model
{
    use HasFactory;

    protected $table = 'cm_daily_tracking';

    protected $fillable = [
        'cm_user_id',
        'brand_id',
        'work_date',
        'tasks',
        'completed_actions',
        'notes',
        'work_minutes',
        'tasks_done',
        'posts_done',
        'stories_done',
        'lives_done',
        'completion_percentage',
        'status',
    ];

    protected $casts = [
        'work_date' => 'date',
    ];

    public function cmUser()
    {
        return $this->belongsTo(User::class, 'cm_user_id');
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }
}
