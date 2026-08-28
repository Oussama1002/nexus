<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmBrandEconomics extends Model
{
    protected $table = 'am_brand_economics';
    protected $fillable = [
        'brand_id', 'product_id', 'market', 'selling_price', 'cogs',
        'packaging_cost', 'transaction_fee', 'shipping_cost',
        'confirmation_cost_per_order', 'aov', 'gross_margin',
        'gross_margin_target', 'target_cac', 'observed_cac', 'ltv',
        'ltv_cac_ratio', 'ltv_cac_threshold', 'net_margin_per_order',
        'updated_by_user_id', 'last_updated_at',
    ];
    protected $casts = [
        'selling_price' => 'decimal:2',
        'cogs' => 'decimal:2',
        'gross_margin' => 'decimal:4',
        'ltv_cac_ratio' => 'decimal:4',
        'last_updated_at' => 'datetime',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
