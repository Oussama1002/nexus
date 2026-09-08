<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatConversationMember extends Model
{
    protected $fillable = ['conversation_id', 'user_id', 'joined_at', 'last_read_at'];
    protected $casts = ['joined_at' => 'datetime', 'last_read_at' => 'datetime'];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(ChatConversation::class, 'conversation_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
