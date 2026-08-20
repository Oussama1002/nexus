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
        'platforms_json',
        'niche',
        'bio',
        'city',
        'audience_size',
        'engagement_rate',
        'qualification_json',
        'qualification_score',
        'qualified_at',
        'qualified_by',
        'pricing_json',
        'contact_phone',
        'contact_email',
        'social_links_json',
        'status',
        'exclusion_reason',
        'excluded_at',
        'excluded_by',
        'ecartee_reason',
        'notes',
        'source',
        'contacted_at',
        'contacted_by',
    ];

    protected $casts = [
        'pricing_json' => 'array',
        'platforms_json' => 'array',
        'social_links_json' => 'array',
        'qualification_json' => 'array',
        'qualified_at' => 'datetime',
        'excluded_at' => 'datetime',
        'contacted_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function qualifiedByUser()
    {
        return $this->belongsTo(User::class, 'qualified_by');
    }

    public function excludedByUser()
    {
        return $this->belongsTo(User::class, 'excluded_by');
    }

    public function contactedByUser()
    {
        return $this->belongsTo(User::class, 'contacted_by');
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

    public function deliverables()
    {
        return $this->hasManyThrough(InfluencerDeliverable::class, InfluencerCollaboration::class, 'influencer_id', 'collaboration_id');
    }

    public function shipments()
    {
        return $this->hasMany(InfluencerShipment::class);
    }

    public function payments()
    {
        return $this->hasMany(InfluencerPayment::class);
    }

    public function documents()
    {
        return $this->hasMany(InfluencerDocument::class);
    }

    public function publishedContents()
    {
        return $this->hasMany(InfluencerPublishedContent::class);
    }
}
