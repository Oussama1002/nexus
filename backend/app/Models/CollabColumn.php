<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CollabColumn extends Model
{
    protected $fillable = [
        'project_id',
        'title',
        'color',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(CollabProject::class, 'project_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(CollabTask::class, 'column_id')->orderBy('sort_order');
    }
}
