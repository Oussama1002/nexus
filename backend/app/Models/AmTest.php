<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmTest extends Model
{
    protected $fillable = [
        'brand_id', 'chantier_id', 'hypothesis', 'tested_variable',
        'population_or_channel', 'start_date', 'end_date', 'budget_engaged',
        'success_metric', 'success_threshold', 'observed_result', 'status',
        'verdict', 'verdict_at', 'verdict_author_user_id',
        'reusable_asset_notes', 'linked_ref_type', 'linked_ref_id', 'parent_test_id',
    ];
    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'success_threshold' => 'decimal:4',
        'observed_result' => 'decimal:4',
        'budget_engaged' => 'decimal:2',
        'verdict_at' => 'datetime',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function chantier(): BelongsTo
    {
        return $this->belongsTo(AmChantier::class, 'chantier_id');
    }
}
