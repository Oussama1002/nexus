<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CmNotification extends Model
{
    use HasFactory;

    protected $table = 'cm_notifications';

    protected $fillable = [
        'brand_id',
        'recipient_user_id',
        'type',
        'title',
        'body',
        'data',
        'related_type',
        'related_id',
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'is_read' => 'boolean',
        'read_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }
}
