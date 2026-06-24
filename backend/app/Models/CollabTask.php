<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CollabTask extends Model
{
    protected $fillable = [
        'project_id',
        'column_id',
        'assigned_to',
        'title',
        'description',
        'priority',
        'due_date',
        'sort_order',
    ];

    protected $casts = [
        'due_date' => 'date',
        'sort_order' => 'integer',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(CollabProject::class, 'project_id');
    }

    public function column(): BelongsTo
    {
        return $this->belongsTo(CollabColumn::class, 'column_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
