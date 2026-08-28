<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AmGateTemplate extends Model
{
    protected $fillable = [
        'roadmap_template_id', 'chantier_template_id', 'code', 'label',
        'description', 'validator_role', 'unlocks_gate_codes_json',
        'unlocks_modules_json', 'is_scaling_gate', 'is_conversion_gate', 'sort_order',
    ];
    protected $casts = [
        'unlocks_gate_codes_json' => 'array',
        'unlocks_modules_json' => 'array',
        'is_scaling_gate' => 'bool',
        'is_conversion_gate' => 'bool',
    ];

    public function roadmapTemplate(): BelongsTo
    {
        return $this->belongsTo(AmRoadmapTemplate::class, 'roadmap_template_id');
    }

    public function chantierTemplate(): BelongsTo
    {
        return $this->belongsTo(AmChantierTemplate::class, 'chantier_template_id');
    }

    public function criteriaTemplates(): HasMany
    {
        return $this->hasMany(AmGateCriteriaTemplate::class, 'gate_template_id');
    }
}
