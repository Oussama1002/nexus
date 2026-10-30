<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SocialComplaint extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'platform',
        'channel',
        'customer_name',
        'customer_link',
        'received_at',
        'reason',
        'description',
        'screenshot_url',
        'status',
        'assigned_to_text',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'received_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function updates()
    {
        return $this->hasMany(SocialComplaintUpdate::class)->orderByDesc('id');
    }
}
