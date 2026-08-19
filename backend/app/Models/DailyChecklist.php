<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DailyChecklist extends Model
{
    use HasFactory;

    protected $table = 'daily_checklists';

    protected $fillable = [
        'brand_id',
        'cm_user_id',
        'work_date',
        'status',
        'validated_by',
        'validated_at',
        'rejection_reason',
        'notes',
        'template_id',
        'completion_rate',
        'punctuality_rate',
        'closed_at',
        'closed_by_user_id',
        'closed_automatically',
    ];

    protected $casts = [
        'work_date' => 'date',
        'validated_at' => 'datetime',
        'closed_at' => 'datetime',
        'completion_rate' => 'decimal:2',
        'punctuality_rate' => 'decimal:2',
        'closed_automatically' => 'boolean',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function cmUser()
    {
        return $this->belongsTo(User::class, 'cm_user_id');
    }

    public function validatedByUser()
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function closedByUser()
    {
        return $this->belongsTo(User::class, 'closed_by_user_id');
    }

    public function template()
    {
        return $this->belongsTo(ChecklistTemplate::class, 'template_id');
    }

    public function items()
    {
        return $this->hasMany(DailyChecklistItem::class);
    }

    public function recalculateRates(): void
    {
        $items = $this->items;
        $total = $items->count();
        if ($total === 0) {
            $this->completion_rate = 0;
            $this->punctuality_rate = 0;
            return;
        }

        $completed = $items->where('is_completed', true)->count();
        $this->completion_rate = round(($completed / $total) * 100, 2);

        $onTime = $items->where('is_completed', true)
            ->filter(fn ($i) => $i->delay_minutes === null || $i->delay_minutes <= 0)
            ->count();
        $this->punctuality_rate = $completed > 0
            ? round(($onTime / $completed) * 100, 2)
            : 0;
    }
}
