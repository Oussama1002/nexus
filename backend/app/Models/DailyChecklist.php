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
    ];

    protected $casts = [
        'work_date' => 'date',
        'validated_at' => 'datetime',
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

    public function items()
    {
        return $this->hasMany(DailyChecklistItem::class);
    }
}
