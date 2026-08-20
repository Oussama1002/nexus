<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'collaboration_id',
        'influencer_id',
        'brand_id',
        'uploaded_by',
        'title',
        'document_type',
        'file_url',
        'file_size',
        'mime_type',
        'notes',
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

    public function uploadedByUser()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
