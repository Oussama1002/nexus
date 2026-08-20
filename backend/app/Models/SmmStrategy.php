<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmStrategy extends Model
{
    use HasFactory;

    protected $table = 'smm_strategies';

    protected $fillable = [
        'brand_id', 'year', 'quarter', 'start_date', 'end_date',
        'social_objectives', 'business_objectives', 'brand_stage',
        'platforms_json', 'platform_roles_json', 'personas_json',
        'finalities_json', 'angles_json', 'tone_of_voice',
        'priority_formats_json', 'publication_frequency_json',
        'kpi_targets_json', 'quarter_priorities', 'status',
        'author_user_id', 'submitted_at', 'validated_by_user_id',
        'validated_at', 'validation_comment', 'rejection_reason',
    ];

    protected $casts = [
        'year' => 'integer',
        'quarter' => 'integer',
        'start_date' => 'date',
        'end_date' => 'date',
        'platforms_json' => 'array',
        'platform_roles_json' => 'array',
        'personas_json' => 'array',
        'finalities_json' => 'array',
        'angles_json' => 'array',
        'priority_formats_json' => 'array',
        'publication_frequency_json' => 'array',
        'kpi_targets_json' => 'array',
        'submitted_at' => 'datetime',
        'validated_at' => 'datetime',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function author() { return $this->belongsTo(User::class, 'author_user_id'); }
    public function validatedBy() { return $this->belongsTo(User::class, 'validated_by_user_id'); }
    public function pillars() { return $this->hasMany(SmmContentPillar::class, 'strategy_id'); }
    public function contributions() { return $this->hasMany(SmmStrategyContribution::class, 'strategy_id'); }
    public function monthlyPlans() { return $this->hasMany(SmmMonthlyPlan::class, 'strategy_id'); }
}
