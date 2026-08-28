<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmGateCriterion extends Model
{
    protected $table = 'am_gate_criteria';
    protected $fillable = [
        'gate_id', 'template_id', 'status', 'observed_value', 'evaluated_at',
        'attested_by_user_id', 'attested_at', 'attestation_comment',
        'validated_deliverable_id',
    ];
    protected $casts = [
        'observed_value' => 'decimal:4',
        'evaluated_at' => 'datetime',
        'attested_at' => 'datetime',
    ];

    public function gate(): BelongsTo
    {
        return $this->belongsTo(AmGate::class, 'gate_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(AmGateCriteriaTemplate::class, 'template_id');
    }
}
