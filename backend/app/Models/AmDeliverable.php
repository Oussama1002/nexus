<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AmDeliverable extends Model
{
    protected $fillable = [
        'chantier_id', 'brand_id', 'label', 'deliverable_type',
        'expected_description', 'producer_user_id', 'deadline', 'status',
        'is_mandatory', 'current_version', 'current_asset_url',
        'validated_by_user_id', 'validated_at', 'refusal_reason',
    ];
    protected $casts = [
        'deadline' => 'date',
        'is_mandatory' => 'bool',
        'validated_at' => 'datetime',
    ];

    public function chantier(): BelongsTo
    {
        return $this->belongsTo(AmChantier::class, 'chantier_id');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function versions(): HasMany
    {
        return $this->hasMany(AmDeliverableVersion::class, 'deliverable_id');
    }

    public function qaCheck(): HasOne
    {
        return $this->hasOne(AmQaCheck::class, 'deliverable_id')->latestOfMany();
    }
}
