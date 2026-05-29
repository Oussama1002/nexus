<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SocialPublication extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'content_calendar_id',
        'social_account_id',
        'platform',
        'title',
        'published_at',
        'reach',
        'impressions',
        'likes',
        'comments',
        'shares',
        'saves',
        'clicks',
        'ctr',
        'source',
        'notes',
        'synced_at',
    ];

    protected $casts = [
        'published_at' => 'datetime',
        'synced_at' => 'datetime',
        'ctr' => 'decimal:4',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function contentCalendar()
    {
        return $this->belongsTo(ContentCalendar::class, 'content_calendar_id');
    }

    public function socialAccount()
    {
        return $this->belongsTo(SocialAccount::class);
    }
}
