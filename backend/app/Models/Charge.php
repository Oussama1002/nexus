<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Charge extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        // Mirror Finance : toute charge génère une écriture comptable (débit).
        static::created(function (Charge $charge) {
            try {
                app(\App\Services\AccountingAutoPostService::class)->postCharge($charge);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('accounting.autopost.charge_failed', [
                    'charge_id' => $charge->id,
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }

    protected $fillable = [
        'brand_id',
        'order_id',
        'campaign_id',
        'influencer_payment_id',
        'created_by',
        'charge_date',
        'type',
        'amount',
        'note',
    ];

    protected $casts = [
        'charge_date' => 'date',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
