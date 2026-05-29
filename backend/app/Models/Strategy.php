<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Strategy extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'created_by',
        'title',
        'marketing_objective',
        'target_audience',
        'key_message',
        'platforms',
        'expected_kpis',
        'budget',
        'period_start',
        'period_end',
        'assigned_cm_id',
        'document_path',
        'status',
        'version',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'platforms' => 'array',
        'period_start' => 'date',
        'period_end' => 'date',
        'budget' => 'decimal:2',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedByUser()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function assignedCm()
    {
        return $this->belongsTo(User::class, 'assigned_cm_id');
    }

    public function contentCalendar()
    {
        return $this->hasMany(ContentCalendar::class);
    }
}
