<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AmChantier extends Model
{
    protected $fillable = [
        'roadmap_id', 'template_id', 'brand_id', 'code', 'owner_user_id',
        'opened_at', 'deadline', 'status', 'lock_reason', 'steps_state_json',
    ];
    protected $casts = [
        'opened_at' => 'datetime',
        'deadline' => 'date',
        'steps_state_json' => 'array',
    ];

    public function roadmap(): BelongsTo
    {
        return $this->belongsTo(AmRoadmap::class, 'roadmap_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(AmChantierTemplate::class, 'template_id');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function gates(): HasMany
    {
        return $this->hasMany(AmGate::class, 'chantier_id');
    }

    public function deliverables(): HasMany
    {
        return $this->hasMany(AmDeliverable::class, 'chantier_id');
    }
}
