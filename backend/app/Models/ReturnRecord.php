<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReturnRecord extends Model
{
    use HasFactory;

    protected $table = 'returns_records';

    protected $fillable = [
        'brand_id', 'order_id', 'order_ref', 'customer_name', 'product_name',
        'reason', 'status', 'amount', 'created_by_user_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function order() { return $this->belongsTo(Order::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by_user_id'); }
}
