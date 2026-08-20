<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerDeliverable extends Model
{
    use HasFactory;

    protected $fillable = [
        'collaboration_id',
        'brand_id',
        'title',
        'content_type',
        'platform',
        'quantity',
        'due_date',
        'status',
        'description',
        'brief_notes',
        'validated_by_user_id',
        'validated_at',
    ];

    protected $casts = [
        'due_date' => 'date',
        'validated_at' => 'datetime',
    ];

    public function collaboration()
    {
        return $this->belongsTo(InfluencerCollaboration::class, 'collaboration_id');
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function validatedByUser()
    {
        return $this->belongsTo(User::class, 'validated_by_user_id');
    }

    public function publishedContents()
    {
        return $this->hasMany(InfluencerPublishedContent::class, 'deliverable_id');
    }
}
