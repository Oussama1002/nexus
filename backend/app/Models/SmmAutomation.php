<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmAutomation extends Model
{
    use HasFactory;

    protected $table = 'smm_automations';

    protected $fillable = [
        'brand_id', 'label', 'objective', 'platform',
        'trigger_type', 'trigger_config',
        'flow_steps_json', 'messages_json',
        'call_to_action_links', 'linked_content_ids_json',
        'status', 'test_recorded', 'tested_at', 'tested_by_user_id',
        'activated_at', 'activated_by_user_id',
        'suspended_at', 'suspended_by_user_id', 'suspension_reason',
        'kpis_json', 'created_by_user_id',
    ];

    protected $casts = [
        'flow_steps_json' => 'array',
        'messages_json' => 'array',
        'linked_content_ids_json' => 'array',
        'kpis_json' => 'array',
        'test_recorded' => 'boolean',
        'tested_at' => 'datetime',
        'activated_at' => 'datetime',
        'suspended_at' => 'datetime',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by_user_id'); }
    public function testedBy() { return $this->belongsTo(User::class, 'tested_by_user_id'); }
    public function activatedBy() { return $this->belongsTo(User::class, 'activated_by_user_id'); }
    public function suspendedBy() { return $this->belongsTo(User::class, 'suspended_by_user_id'); }
    public function contents() { return $this->belongsToMany(SmmContent::class, 'smm_content_automation', 'automation_id', 'content_id'); }
}
