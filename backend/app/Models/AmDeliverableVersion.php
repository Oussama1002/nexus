<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmDeliverableVersion extends Model
{
    protected $fillable = [
        'deliverable_id', 'version_label', 'asset_url',
        'uploaded_by_user_id', 'uploaded_at', 'notes',
    ];
    protected $casts = ['uploaded_at' => 'datetime'];

    public function deliverable(): BelongsTo
    {
        return $this->belongsTo(AmDeliverable::class, 'deliverable_id');
    }
}
