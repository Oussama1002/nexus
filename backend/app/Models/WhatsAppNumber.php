<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WhatsAppNumber extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_numbers';

    protected $fillable = [
        'brand_id',
        'phone_id',
        'waba_id',
        'display_number',
        'verified_name',
        'label',
        'api_token',
        'api_base_url',
        'is_active',
        'is_default',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_default' => 'boolean',
    ];

    protected $hidden = [
        'api_token',
    ];

    /**
     * Safe payload for API (never exposes the token, only a "configured" flag).
     *
     * @return array<string, mixed>
     */
    public function toSafeArray(): array
    {
        return [
            'id' => $this->id,
            'brand_id' => $this->brand_id,
            'phone_id' => $this->phone_id,
            'waba_id' => $this->waba_id,
            'display_number' => $this->display_number,
            'verified_name' => $this->verified_name,
            'label' => $this->label,
            'api_token_configured' => (string) ($this->api_token ?? '') !== '',
            'api_base_url' => $this->api_base_url,
            'is_active' => (bool) $this->is_active,
            'is_default' => (bool) $this->is_default,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function conversations()
    {
        return $this->hasMany(Conversation::class, 'whatsapp_number_id');
    }
}
