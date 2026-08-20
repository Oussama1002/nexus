<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerValidationRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'validation_type',
        'entity_type',
        'entity_id',
        'requested_by',
        'requested_at',
        'decided_by',
        'decided_at',
        'decision',
        'comment',
        'context_json',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'decided_at' => 'datetime',
        'context_json' => 'array',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function requestedByUser()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function decidedByUser()
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function entity()
    {
        return $this->morphTo('entity', 'entity_type', 'entity_id');
    }
}
