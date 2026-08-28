<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AmRoadmap extends Model
{
    protected $fillable = [
        'brand_id', 'template_id', 'status', 'brand_lifecycle_stage',
        'account_manager_user_id', 'opened_by_user_id', 'opened_at',
        'approved_by_user_id', 'approved_at', 'target_end_date',
        'last_gate_transit_at', 'current_gate_code', 'closure_summary', 'notes',
    ];
    protected $casts = [
        'opened_at' => 'datetime',
        'approved_at' => 'datetime',
        'last_gate_transit_at' => 'datetime',
        'target_end_date' => 'date',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(AmRoadmapTemplate::class, 'template_id');
    }

    public function accountManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'account_manager_user_id');
    }

    public function chantiers(): HasMany
    {
        return $this->hasMany(AmChantier::class, 'roadmap_id');
    }

    public function gates(): HasMany
    {
        return $this->hasMany(AmGate::class, 'roadmap_id');
    }
}
