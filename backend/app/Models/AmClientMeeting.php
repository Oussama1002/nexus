<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AmClientMeeting extends Model
{
    protected $fillable = [
        'brand_id', 'scheduled_at', 'internal_participants_json',
        'brand_participants_json', 'agenda', 'topics_covered',
        'decisions_taken', 'status', 'minutes_author_user_id',
        'held_at', 'closed_at',
    ];
    protected $casts = [
        'scheduled_at' => 'datetime',
        'held_at' => 'datetime',
        'closed_at' => 'datetime',
        'internal_participants_json' => 'array',
        'brand_participants_json' => 'array',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function actions(): HasMany
    {
        return $this->hasMany(AmMeetingAction::class, 'meeting_id');
    }
}
