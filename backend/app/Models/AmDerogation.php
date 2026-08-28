<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmDerogation extends Model
{
    protected $fillable = [
        'gate_id', 'brand_id', 'requested_by_user_id', 'requested_at',
        'request_reason', 'identified_risk', 'compensatory_measure', 'status',
        'decided_by_user_id', 'decided_at', 'decision_reason', 'expires_at',
        'lifting_condition',
    ];
    protected $casts = [
        'requested_at' => 'datetime',
        'decided_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function gate(): BelongsTo
    {
        return $this->belongsTo(AmGate::class, 'gate_id');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
