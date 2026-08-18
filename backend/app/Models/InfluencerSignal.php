<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerSignal extends Model
{
    use HasFactory;

    protected $table = 'influencer_signals';

    protected $fillable = [
        'brand_id',
        'cm_user_id',
        'influencer_id',
        'signal_type',
        'severity',
        'description',
        'status',
        'resolved_by',
        'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function cmUser()
    {
        return $this->belongsTo(User::class, 'cm_user_id');
    }

    public function influencer()
    {
        return $this->belongsTo(Influencer::class);
    }

    public function resolvedByUser()
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
