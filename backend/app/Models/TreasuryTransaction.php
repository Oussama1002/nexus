<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TreasuryTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id', 'account_id', 'date', 'label', 'type', 'category',
        'amount', 'reference', 'notes', 'created_by_user_id',
    ];

    protected $casts = [
        'date' => 'date',
        'amount' => 'decimal:2',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function account() { return $this->belongsTo(TreasuryAccount::class, 'account_id'); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by_user_id'); }
}
