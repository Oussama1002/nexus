<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AdMetric extends Model
{
    use HasFactory;

    protected $fillable = [
        'ad_id', 'metric_date', 'spend', 'impressions', 'clicks', 'reach',
        'leads', 'messages', 'ctr', 'frequency', 'cpc', 'cpm', 'cpl',
    ];

    protected $casts = [
        'metric_date' => 'date',
        'spend' => 'decimal:2',
        'ctr' => 'decimal:4',
        'frequency' => 'decimal:4',
        'cpc' => 'decimal:4',
        'cpm' => 'decimal:4',
        'cpl' => 'decimal:4',
    ];

    public function ad()
    {
        return $this->belongsTo(Ad::class);
    }
}
