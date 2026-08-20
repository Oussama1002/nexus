<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmPerformanceSnapshot extends Model
{
    use HasFactory;

    protected $table = 'smm_performance_snapshots';

    protected $fillable = [
        'content_id', 'platform', 'snapshot_at', 'metrics_json',
    ];

    protected $casts = [
        'snapshot_at' => 'datetime',
        'metrics_json' => 'array',
    ];

    public function content() { return $this->belongsTo(SmmContent::class, 'content_id'); }
}
