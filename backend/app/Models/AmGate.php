<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AmGate extends Model
{
    protected $fillable = [
        'roadmap_id', 'template_id', 'chantier_id', 'brand_id', 'code', 'status',
        'requested_by_user_id', 'requested_at', 'validated_by_user_id',
        'validated_at', 'refusal_reason',
    ];
    protected $casts = [
        'requested_at' => 'datetime',
        'validated_at' => 'datetime',
    ];

    public function roadmap(): BelongsTo
    {
        return $this->belongsTo(AmRoadmap::class, 'roadmap_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(AmGateTemplate::class, 'template_id');
    }

    public function chantier(): BelongsTo
    {
        return $this->belongsTo(AmChantier::class, 'chantier_id');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function criteria(): HasMany
    {
        return $this->hasMany(AmGateCriterion::class, 'gate_id');
    }

    public function derogations(): HasMany
    {
        return $this->hasMany(AmDerogation::class, 'gate_id');
    }
}
