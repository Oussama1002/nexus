<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'supplier_id',
        'name',
        'sku',
        'description',
        'category',
        'product_type',
        'price',
        'cost',
        'stock_quantity',
        'reserved_quantity',
        'low_stock_threshold',
        'status',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function stockMovements()
    {
        return $this->hasMany(StockMovement::class);
    }

    public function orderLines()
    {
        return $this->hasMany(OrderLine::class);
    }
}
