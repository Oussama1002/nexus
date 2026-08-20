<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmContent extends Model
{
    use HasFactory;

    protected $table = 'smm_contents';

    protected $fillable = [
        'brand_id', 'monthly_plan_id', 'pillar_id', 'event_id', 'source_content_id',
        'title', 'concept', 'platform', 'format', 'finality', 'angle',
        'persona_id', 'social_account',
        'production_mode', 'assigned_user_id', 'briefed_at', 'production_due_at',
        'scheduled_publish_at',
        'is_sensitive', 'sensitivity_reason',
        'status', 'revision_rounds', 'validated_at', 'validated_by_user_id',
        'transmitted_at', 'published_at', 'published_platform_id',
        'not_published_reason', 'cancellation_reason',
        'file_identifier', 'author_user_id',
    ];

    protected $casts = [
        'is_sensitive' => 'boolean',
        'revision_rounds' => 'integer',
        'briefed_at' => 'datetime',
        'production_due_at' => 'datetime',
        'scheduled_publish_at' => 'datetime',
        'validated_at' => 'datetime',
        'transmitted_at' => 'datetime',
        'published_at' => 'datetime',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function monthlyPlan() { return $this->belongsTo(SmmMonthlyPlan::class, 'monthly_plan_id'); }
    public function pillar() { return $this->belongsTo(SmmContentPillar::class, 'pillar_id'); }
    public function event() { return $this->belongsTo(SmmEvent::class, 'event_id'); }
    public function sourceContent() { return $this->belongsTo(SmmContent::class, 'source_content_id'); }
    public function assignedTo() { return $this->belongsTo(User::class, 'assigned_user_id'); }
    public function author() { return $this->belongsTo(User::class, 'author_user_id'); }
    public function validatedBy() { return $this->belongsTo(User::class, 'validated_by_user_id'); }

    public function brief() { return $this->hasOne(SmmBrief::class, 'content_id'); }
    public function versions() { return $this->hasMany(SmmContentVersion::class, 'content_id'); }
    public function revisions() { return $this->hasMany(SmmContentRevision::class, 'content_id'); }
    public function qcChecklist() { return $this->hasOne(SmmQcChecklist::class, 'content_id'); }
    public function publicationSlip() { return $this->hasOne(SmmPublicationSlip::class, 'content_id'); }
    public function executionChecks() { return $this->hasMany(SmmExecutionCheck::class, 'content_id'); }
    public function performances() { return $this->hasMany(SmmContentPerformance::class, 'content_id'); }
    public function performanceSnapshots() { return $this->hasMany(SmmPerformanceSnapshot::class, 'content_id'); }
    public function automations() { return $this->belongsToMany(SmmAutomation::class, 'smm_content_automation', 'content_id', 'automation_id'); }
    public function insights() { return $this->belongsToMany(SmmClientInsight::class, 'smm_content_insight', 'content_id', 'insight_id'); }

    /** Derived: En retard — status not Publié yet scheduled_publish_at passed. */
    public function getIsLateAttribute(): bool
    {
        return $this->status !== 'publie'
            && $this->scheduled_publish_at
            && $this->scheduled_publish_at->isPast();
    }
}
