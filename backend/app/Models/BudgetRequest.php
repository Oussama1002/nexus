<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BudgetRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id', 'budget_id', 'requester_user_id',
        'amount', 'reason', 'priority', 'status',
        'approved_amount', 'approved_by_user_id',
        'decided_at', 'decision_note',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'approved_amount' => 'decimal:2',
        'decided_at' => 'datetime',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function budget() { return $this->belongsTo(Budget::class); }
    public function requester() { return $this->belongsTo(User::class, 'requester_user_id'); }
    public function approvedBy() { return $this->belongsTo(User::class, 'approved_by_user_id'); }
}
