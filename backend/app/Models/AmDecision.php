<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmDecision extends Model
{
    protected $fillable = [
        'brand_id', 'decided_at', 'author_user_id', 'subject', 'context',
        'invoked_indicator', 'invoked_value', 'decision_taken',
        'rejected_alternative', 'expected_consequence',
        'linked_object_type', 'linked_object_id', 'review_date', 'reviewed_outcome',
    ];
    protected $casts = ['decided_at' => 'datetime', 'review_date' => 'date'];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }
}
