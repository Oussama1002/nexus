<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'collaboration_id',
        'influencer_id',
        'brand_id',
        'created_by',
        'reference',
        'nature',
        'status',
        'amount',
        'currency',
        'payment_method',
        'description',
        'period_start',
        'period_end',
        'due_date',
        'paid_at',
        'proof_url',
        'v3_n1_status',
        'v3_n1_decided_by',
        'v3_n1_decided_at',
        'v3_n1_comment',
        'v3_n2_status',
        'v3_n2_decided_by',
        'v3_n2_decided_at',
        'v3_n2_comment',
        'rejection_reason',
        'notes',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'due_date' => 'date',
        'paid_at' => 'date',
        'v3_n1_decided_at' => 'datetime',
        'v3_n2_decided_at' => 'datetime',
    ];

    public function collaboration()
    {
        return $this->belongsTo(InfluencerCollaboration::class, 'collaboration_id');
    }

    public function influencer()
    {
        return $this->belongsTo(Influencer::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function createdByUser()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function v3N1DecidedByUser()
    {
        return $this->belongsTo(User::class, 'v3_n1_decided_by');
    }

    public function v3N2DecidedByUser()
    {
        return $this->belongsTo(User::class, 'v3_n2_decided_by');
    }
}
