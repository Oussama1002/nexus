<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ModerationAction extends Model
{
    use HasFactory;

    protected $table = 'moderation_actions';

    protected $fillable = [
        'brand_id',
        'cm_user_id',
        'social_account_id',
        'platform',
        'action_type',
        'description',
        'screenshot_url',
        'action_date',
    ];

    protected $casts = [
        'action_date' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function cmUser()
    {
        return $this->belongsTo(User::class, 'cm_user_id');
    }

    public function socialAccount()
    {
        return $this->belongsTo(SocialAccount::class);
    }
}
