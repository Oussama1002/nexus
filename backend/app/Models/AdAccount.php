<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AdAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'responsible_user_id',
        'platform',
        'account_name',
        'external_account_id',
        'business_manager_id',
        'access_token_ref',
        'refresh_token_ref',
        'webhook_secret_ref',
        'currency',
        'timezone',
        'country',
        'api_connected',
        'status',
        'notes',
        'last_synced_at',
    ];

    protected $casts = [
        'api_connected' => 'boolean',
        'last_synced_at' => 'datetime',
    ];

    protected $hidden = [
        'access_token_ref',
        'refresh_token_ref',
        'webhook_secret_ref',
    ];

    /**
     * Safe payload for API (never exposes sensitive refs).
     *
     * @return array<string, mixed>
     */
    public function toSafeArray(): array
    {
        $base = $this->only([
            'id', 'brand_id', 'responsible_user_id', 'platform', 'account_name',
            'external_account_id', 'business_manager_id',
            'currency', 'timezone', 'country', 'api_connected', 'status', 'notes',
            'created_at', 'updated_at',
        ]);

        $base['access_token_masked'] = $this->access_token_ref ? '************' : null;
        $base['refresh_token_masked'] = $this->refresh_token_ref ? '************' : null;
        $base['webhook_secret_masked'] = $this->webhook_secret_ref ? '************' : null;

        if ($this->relationLoaded('responsible') && $this->responsible) {
            $base['responsible'] = [
                'id' => $this->responsible->id,
                'name' => $this->responsible->name,
            ];
        }

        if ($this->relationLoaded('brand') && $this->brand) {
            $base['brand'] = [
                'id' => $this->brand->id,
                'name' => $this->brand->name,
            ];
        }

        return $base;
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function responsible()
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function campaigns()
    {
        return $this->hasMany(Campaign::class);
    }
}
