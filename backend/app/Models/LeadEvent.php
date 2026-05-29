<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeadEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'lead_id',
        'actor_user_id',
        'event_type',
        'description',
        'payload',
        'event_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'event_at' => 'datetime',
    ];

    public function lead()
    {
        return $this->belongsTo(Lead::class);
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
