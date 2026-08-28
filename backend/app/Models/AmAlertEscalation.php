<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmAlertEscalation extends Model
{
    protected $fillable = ['alert_id', 'level', 'escalated_to_user_id', 'escalated_at'];
    protected $casts = ['escalated_at' => 'datetime'];

    public function alert(): BelongsTo
    {
        return $this->belongsTo(AmAlert::class, 'alert_id');
    }
}
