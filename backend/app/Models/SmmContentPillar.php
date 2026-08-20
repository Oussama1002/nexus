<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmContentPillar extends Model
{
    use HasFactory;

    protected $table = 'smm_content_pillars';

    protected $fillable = [
        'brand_id', 'strategy_id', 'label', 'description',
        'business_objective', 'target_share_percent', 'formats_json', 'is_active',
    ];

    protected $casts = [
        'target_share_percent' => 'decimal:2',
        'formats_json' => 'array',
        'is_active' => 'boolean',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function strategy() { return $this->belongsTo(SmmStrategy::class, 'strategy_id'); }
    public function contents() { return $this->hasMany(SmmContent::class, 'pillar_id'); }
}
