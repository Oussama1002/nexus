<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AmChantierTemplate extends Model
{
    protected $fillable = [
        'roadmap_template_id', 'code', 'label', 'objective', 'trigger',
        'prerequisite_gate_codes', 'steps_json', 'expected_deliverable_types_json',
        'output_kpis_json', 'academy_sop_ref', 'sort_order',
    ];
    protected $casts = [
        'prerequisite_gate_codes' => 'array',
        'steps_json' => 'array',
        'expected_deliverable_types_json' => 'array',
        'output_kpis_json' => 'array',
    ];

    public function roadmapTemplate(): BelongsTo
    {
        return $this->belongsTo(AmRoadmapTemplate::class, 'roadmap_template_id');
    }

    public function gateTemplates(): HasMany
    {
        return $this->hasMany(AmGateTemplate::class, 'chantier_template_id');
    }
}
