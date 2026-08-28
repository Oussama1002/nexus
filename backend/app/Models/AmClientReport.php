<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmClientReport extends Model
{
    protected $fillable = [
        'brand_id', 'template_id', 'period', 'sections_data_json',
        'account_manager_comment', 'status', 'drafted_by_user_id',
        'validated_by_user_id', 'validated_at', 'published_by_user_id',
        'published_at', 'recipient_user_ids_json', 'acknowledged_at', 'version',
    ];
    protected $casts = [
        'sections_data_json' => 'array',
        'recipient_user_ids_json' => 'array',
        'validated_at' => 'datetime',
        'published_at' => 'datetime',
        'acknowledged_at' => 'datetime',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(AmReportTemplate::class, 'template_id');
    }
}
