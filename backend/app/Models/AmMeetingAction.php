<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmMeetingAction extends Model
{
    protected $fillable = ['meeting_id', 'action', 'assignee_user_id', 'due_date', 'status', 'done_at'];
    protected $casts = ['due_date' => 'date', 'done_at' => 'datetime'];

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(AmClientMeeting::class, 'meeting_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_user_id');
    }
}
