<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClientInvoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'customer_id',
        'order_id',
        'contract_id',
        'created_by',
        'approval_user_id',
        'invoice_number',
        'billing_period_start',
        'billing_period_end',
        'issue_date',
        'due_date',
        'currency',
        'subtotal',
        'discount',
        'tax_amount',
        'total',
        'status',
        'recipient_email',
        'approved_at',
        'sent_at',
        'paid_at',
        'email_last_error',
        'notes',
        'meta',
    ];

    protected $casts = [
        'billing_period_start' => 'date',
        'billing_period_end' => 'date',
        'issue_date' => 'date',
        'due_date' => 'date',
        'approved_at' => 'datetime',
        'sent_at' => 'datetime',
        'paid_at' => 'datetime',
        'meta' => 'array',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function contract()
    {
        return $this->belongsTo(ClientContract::class, 'contract_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approval_user_id');
    }
}
