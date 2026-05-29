<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MediaBuyingEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'campaign_id',
        'ad_account_id',
        'source_entry_id',
        'title',
        'angle',
        'format',
        'hook',
        'script',
        'cta',
        'asset_url',
        'external_ad_id',
        'status',
        'tested_at',
        'spend',
        'revenue',
        'leads',
        'confirmed_orders',
        'cpa',
        'ctr',
        'roas',
        'repurpose_priority',
        'repurpose_notes',
        'is_repurposed',
    ];

    protected $casts = [
        'tested_at' => 'date',
        'spend' => 'decimal:2',
        'revenue' => 'decimal:2',
        'cpa' => 'decimal:4',
        'ctr' => 'decimal:4',
        'roas' => 'decimal:4',
        'is_repurposed' => 'boolean',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function adAccount()
    {
        return $this->belongsTo(AdAccount::class);
    }

    public function sourceEntry()
    {
        return $this->belongsTo(self::class, 'source_entry_id');
    }
}
