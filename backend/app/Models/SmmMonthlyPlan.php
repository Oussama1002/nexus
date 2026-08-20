<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmMonthlyPlan extends Model
{
    use HasFactory;

    protected $table = 'smm_monthly_plans';

    protected $fillable = [
        'brand_id', 'strategy_id', 'year', 'month',
        'volume_by_platform_json', 'split_by_format_json',
        'split_by_pillar_json', 'split_by_finality_json',
        'declared_capacity', 'status',
        'author_user_id', 'submitted_at',
        'validated_by_user_id', 'validated_at',
        'validation_comment', 'rejection_reason',
    ];

    protected $casts = [
        'year' => 'integer',
        'month' => 'integer',
        'volume_by_platform_json' => 'array',
        'split_by_format_json' => 'array',
        'split_by_pillar_json' => 'array',
        'split_by_finality_json' => 'array',
        'submitted_at' => 'datetime',
        'validated_at' => 'datetime',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function strategy() { return $this->belongsTo(SmmStrategy::class, 'strategy_id'); }
    public function author() { return $this->belongsTo(User::class, 'author_user_id'); }
    public function validatedBy() { return $this->belongsTo(User::class, 'validated_by_user_id'); }
    public function contents() { return $this->hasMany(SmmContent::class, 'monthly_plan_id'); }
}
