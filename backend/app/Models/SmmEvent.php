<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmEvent extends Model
{
    use HasFactory;

    protected $table = 'smm_events';

    protected $fillable = [
        'brand_id', 'label', 'event_type', 'amplitude',
        'start_date', 'end_date', 'anticipation_days',
        'commercial_offers', 'coordinated_departments_json',
        'milestones_json', 'cm_instructions', 'status',
        'created_by_user_id', 'validated_by_user_id', 'validated_at',
        'has_commercial_offer',
        'direction_validated_by_user_id', 'direction_validated_at',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'anticipation_days' => 'integer',
        'coordinated_departments_json' => 'array',
        'milestones_json' => 'array',
        'validated_at' => 'datetime',
        'has_commercial_offer' => 'boolean',
        'direction_validated_at' => 'datetime',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by_user_id'); }
    public function validatedBy() { return $this->belongsTo(User::class, 'validated_by_user_id'); }
    public function directionValidatedBy() { return $this->belongsTo(User::class, 'direction_validated_by_user_id'); }
    public function contents() { return $this->hasMany(SmmContent::class, 'event_id'); }
}
