<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AmAlert extends Model
{
    protected $fillable = [
        'brand_id', 'rule_code', 'severity', 'label', 'description',
        'trigger_value', 'opened_at', 'recipient_user_id',
        'target_resolution_minutes', 'status', 'taken_at', 'resolved_at',
        'resolution_action', 'closure_reason',
    ];
    protected $casts = [
        'opened_at' => 'datetime',
        'taken_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    public function escalations(): HasMany
    {
        return $this->hasMany(AmAlertEscalation::class, 'alert_id');
    }
}
