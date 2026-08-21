<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryFailure extends Model
{
    use HasFactory;

    protected $table = 'delivery_failures';

    protected $fillable = [
        'brand_id', 'order_id', 'tracking_number', 'order_ref',
        'customer_name', 'carrier', 'reason', 'attempts',
        'status', 'failed_at', 'created_by_user_id',
    ];

    protected $casts = [
        'attempts' => 'integer',
        'failed_at' => 'datetime',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function order() { return $this->belongsTo(Order::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by_user_id'); }
}
