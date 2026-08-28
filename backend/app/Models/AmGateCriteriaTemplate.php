<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmGateCriteriaTemplate extends Model
{
    protected $fillable = [
        'gate_template_id', 'label', 'verification_mode', 'source', 'operator',
        'threshold', 'description', 'is_mandatory', 'sort_order',
    ];
    protected $casts = ['is_mandatory' => 'bool', 'threshold' => 'decimal:4'];

    public function gateTemplate(): BelongsTo
    {
        return $this->belongsTo(AmGateTemplate::class, 'gate_template_id');
    }
}
