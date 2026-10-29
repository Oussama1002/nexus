<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CustomerFollowUp extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'customer_id',
        'order_id',
        'assigned_user_id',
        'sequence',
        'due_at',
        'status',
        'result',
        'opportunity',
        'upsell_amount',
        'notes',
        'completed_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'due_at' => 'date',
        'completed_at' => 'datetime',
        'upsell_amount' => 'decimal:2',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }
}
