<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InternalDmTyping extends Model
{
    protected $table = 'internal_dm_typing';

    protected $fillable = ['user_id', 'peer_user_id', 'last_typing_at'];

    protected $casts = ['last_typing_at' => 'datetime'];
}
