<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmDiffusionSuspension extends Model
{
    protected $fillable = [
        'brand_id', 'compliance_check_id', 'product_id', 'reason',
        'suspended_by_user_id', 'suspended_at', 'lifted_by_user_id',
        'lifted_at', 'lifting_reason', 'is_active',
    ];
    protected $casts = [
        'suspended_at' => 'datetime',
        'lifted_at' => 'datetime',
        'is_active' => 'bool',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function complianceCheck(): BelongsTo
    {
        return $this->belongsTo(AmComplianceCheck::class, 'compliance_check_id');
    }
}
