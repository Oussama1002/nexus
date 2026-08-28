<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmBrandObjective extends Model
{
    protected $fillable = [
        'brand_id', 'period', 'metric_code', 'target_value',
        'observed_value', 'set_by_user_id',
    ];
    protected $casts = [
        'target_value' => 'decimal:4',
        'observed_value' => 'decimal:4',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
