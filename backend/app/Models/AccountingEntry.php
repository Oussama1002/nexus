<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountingEntry extends Model
{
    protected $fillable = [
        'brand_id',
        'account_id',
        'entry_date',
        'journal',
        'reference',
        'label',
        'debit',
        'credit',
        'created_by',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'debit' => 'decimal:2',
        'credit' => 'decimal:2',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function account()
    {
        return $this->belongsTo(AccountingAccount::class, 'account_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
