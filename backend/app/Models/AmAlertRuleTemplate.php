<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AmAlertRuleTemplate extends Model
{
    protected $fillable = [
        'code', 'label', 'severity', 'trigger_type', 'trigger_config_json',
        'default_recipient_role', 'target_resolution_minutes', 'is_active',
    ];
    protected $casts = ['trigger_config_json' => 'array', 'is_active' => 'bool'];
}
