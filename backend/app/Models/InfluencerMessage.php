<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerMessage extends Model
{
    use HasFactory;

    protected $table = 'influencer_messages';

    protected $fillable = [
        'influencer_id',
        'influencer_collaboration_id',
        'sender_user_id',
        'direction',
        'channel',
        'message',
        'message_at',
    ];

    protected $casts = [
        'message_at' => 'datetime',
    ];

    public function influencer()
    {
        return $this->belongsTo(Influencer::class);
    }

    public function collaboration()
    {
        return $this->belongsTo(InfluencerCollaboration::class, 'influencer_collaboration_id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }
}
