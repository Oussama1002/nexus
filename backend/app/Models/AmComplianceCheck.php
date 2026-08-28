<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmComplianceCheck extends Model
{
    protected $fillable = [
        'brand_id', 'product_id', 'market', 'product_type', 'checkpoints_json',
        'responsible_user_id', 'status', 'last_verified_at', 'review_due_date',
    ];
    protected $casts = [
        'checkpoints_json' => 'array',
        'last_verified_at' => 'datetime',
        'review_due_date' => 'date',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
