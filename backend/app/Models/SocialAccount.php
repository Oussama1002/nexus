<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SocialAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'responsible_user_id',
        'platform',
        'account_name',
        'handle',
        'profile_url',
        'credential_ref',
        'api_connected',
        'follower_count',
        'status',
    ];

    protected $casts = [
        'api_connected' => 'boolean',
    ];

    protected $hidden = [
        'credential_ref',
    ];

    /**
     * @return array<string, mixed>
     */
    public function toSafeArray(): array
    {
        $a = $this->toArray();
        unset($a['credential_ref']);

        return $a;
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function responsible()
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function contentCalendar()
    {
        return $this->hasMany(ContentCalendar::class);
    }
}
