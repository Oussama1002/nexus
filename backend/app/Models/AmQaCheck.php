<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmQaCheck extends Model
{
    protected $fillable = [
        'deliverable_id', 'grid_template_id', 'criteria_scores_json',
        'score', 'verdict', 'comment', 'checked_by_user_id', 'checked_at',
    ];
    protected $casts = [
        'criteria_scores_json' => 'array',
        'score' => 'decimal:2',
        'checked_at' => 'datetime',
    ];

    public function deliverable(): BelongsTo
    {
        return $this->belongsTo(AmDeliverable::class, 'deliverable_id');
    }

    public function gridTemplate(): BelongsTo
    {
        return $this->belongsTo(AmQaGridTemplate::class, 'grid_template_id');
    }
}
