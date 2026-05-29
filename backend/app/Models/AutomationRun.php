<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AutomationRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'automation_rule_id',
        'trigger_key',
        'event_payload_json',
        'context_payload_json',
        'result_payload_json',
        'status',
        'result_message',
    ];

    protected $casts = [
        'event_payload_json' => 'array',
        'context_payload_json' => 'array',
        'result_payload_json' => 'array',
    ];

    public function rule()
    {
        return $this->belongsTo(AutomationRule::class, 'automation_rule_id');
    }
}
