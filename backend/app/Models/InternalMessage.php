<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InternalMessage extends Model
{
    protected $fillable = [
        'sender_id',
        'receiver_id',
        'conversation_id',
        'body',
        'attachment_url',
        'attachment_name',
        'attachment_mime',
        'attachment_size',
        'read_at',
    ];

    protected $casts = [
        'read_at' => 'datetime',
    ];

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }
}
