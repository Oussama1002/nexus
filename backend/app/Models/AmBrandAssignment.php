<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmBrandAssignment extends Model
{
    protected $fillable = [
        'brand_id', 'user_id', 'role_on_brand', 'quotity_percent',
        'quotity_hours_per_week', 'starts_at', 'ends_at', 'status',
    ];
    protected $casts = [
        'quotity_percent' => 'decimal:2',
        'starts_at' => 'date',
        'ends_at' => 'date',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
