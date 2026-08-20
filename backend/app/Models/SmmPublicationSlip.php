<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmPublicationSlip extends Model
{
    use HasFactory;

    protected $table = 'smm_publication_slips';

    protected $fillable = [
        'content_id', 'platform', 'publish_at',
        'caption', 'call_to_action', 'hashtags',
        'story_instructions', 'specific_instructions',
        'sensitive_topics_watch', 'linked_automation_ids_json',
        'is_complete',
    ];

    protected $casts = [
        'publish_at' => 'datetime',
        'linked_automation_ids_json' => 'array',
        'is_complete' => 'boolean',
    ];

    public function content() { return $this->belongsTo(SmmContent::class, 'content_id'); }
}
