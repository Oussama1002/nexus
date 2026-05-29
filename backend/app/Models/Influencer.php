<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Influencer extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'full_name',
        'username',
        'platform',
        'niche',
        'audience_size',
        'engagement_rate',
        'pricing_json',
        'contact_phone',
        'contact_email',
        'status',
    ];

    protected $casts = [
        'pricing_json' => 'array',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function collaborations()
    {
        return $this->hasMany(InfluencerCollaboration::class);
    }

    public function messages()
    {
        return $this->hasMany(InfluencerMessage::class);
    }

    public function complaints()
    {
        return $this->hasMany(InfluencerComplaint::class);
    }

    public function performance()
    {
        return $this->hasMany(InfluencerPerformance::class);
    }
}
