<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContentCalendar extends Model
{
    use HasFactory;

    protected $table = 'content_calendar';

    protected $fillable = [
        'brand_id',
        'social_account_id',
        'platform',
        'strategy_id',
        'assigned_to',
        'content_type',
        'title',
        'description',
        'caption',
        'attachments_json',
        'planned_at',
        'published_at',
        'validated_by',
        'validated_at',
        'status',
    ];

    protected $casts = [
        'planned_at' => 'datetime',
        'published_at' => 'datetime',
        'validated_at' => 'datetime',
        'attachments_json' => 'array',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function socialAccount()
    {
        return $this->belongsTo(SocialAccount::class);
    }

    public function strategy()
    {
        return $this->belongsTo(Strategy::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function validatedByUser()
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function productions()
    {
        return $this->hasMany(ContentProduction::class);
    }
}
