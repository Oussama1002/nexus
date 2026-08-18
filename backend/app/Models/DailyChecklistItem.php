<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DailyChecklistItem extends Model
{
    use HasFactory;

    protected $table = 'daily_checklist_items';

    protected $fillable = [
        'daily_checklist_id',
        'label',
        'is_completed',
        'completed_at',
        'category',
        'notes',
    ];

    protected $casts = [
        'is_completed' => 'boolean',
        'completed_at' => 'datetime',
    ];

    public function checklist()
    {
        return $this->belongsTo(DailyChecklist::class, 'daily_checklist_id');
    }
}
