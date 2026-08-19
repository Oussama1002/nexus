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
        'task_type',
        'scheduled_time',
        'platform',
        'content_item_id',
        'status',
        'delay_minutes',
        'justification',
        'comment',
        'notes',
    ];

    protected $casts = [
        'is_completed' => 'boolean',
        'completed_at' => 'datetime',
        'scheduled_time' => 'string',
        'delay_minutes' => 'integer',
    ];

    public function checklist()
    {
        return $this->belongsTo(DailyChecklist::class, 'daily_checklist_id');
    }

    public function contentItem()
    {
        return $this->belongsTo(ContentCalendar::class, 'content_item_id');
    }
}
