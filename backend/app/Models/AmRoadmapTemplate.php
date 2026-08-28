<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AmRoadmapTemplate extends Model
{
    protected $fillable = ['code', 'label', 'description', 'is_active', 'is_default'];
    protected $casts = ['is_active' => 'bool', 'is_default' => 'bool'];

    public function chantierTemplates(): HasMany
    {
        return $this->hasMany(AmChantierTemplate::class, 'roadmap_template_id');
    }

    public function gateTemplates(): HasMany
    {
        return $this->hasMany(AmGateTemplate::class, 'roadmap_template_id');
    }

    public function roadmaps(): HasMany
    {
        return $this->hasMany(AmRoadmap::class, 'template_id');
    }
}
