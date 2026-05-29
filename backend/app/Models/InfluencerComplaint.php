<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerComplaint extends Model
{
    use HasFactory;

    protected $table = 'influencer_complaints';

    protected $fillable = [
        'influencer_id',
        'influencer_collaboration_id',
        'reported_by',
        'title',
        'category',
        'description',
        'severity',
        'status',
        'resolution_notes',
        'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function influencer()
    {
        return $this->belongsTo(Influencer::class);
    }

    public function collaboration()
    {
        return $this->belongsTo(InfluencerCollaboration::class, 'influencer_collaboration_id');
    }

    public function reporter()
    {
        return $this->belongsTo(User::class, 'reported_by');
    }
}
