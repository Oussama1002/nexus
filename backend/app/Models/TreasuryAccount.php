<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TreasuryAccount extends Model
{
    use HasFactory;

    protected $fillable = ['brand_id', 'name', 'kind', 'initial_balance', 'currency', 'is_active', 'notes'];

    protected $casts = [
        'initial_balance' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function transactions() { return $this->hasMany(TreasuryTransaction::class, 'account_id'); }
}
