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
        'account_handle',
        'public_comment_deleted',
        'message_sent',
        'complaint_id',
        'screenshot_url',
        'action_date',
    ];

    protected $casts = [
        'action_date' => 'datetime',
        'public_comment_deleted' => 'boolean',
        'message_sent' => 'boolean',
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

    public function complaint()
    {
        return $this->belongsTo(Complaint::class);
    }
}
