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

    /**
     * Spec §6.6 — the mandatory fields required before transmission to CM:
     * content, platform, exact publish_at, caption, call_to_action, hashtags.
     * The is_complete boolean is auto-computed on every save via booted().
     */
    public function computeIsComplete(): bool
    {
        return
            !empty($this->content_id)
            && !empty($this->platform)
            && !empty($this->publish_at)
            && !empty(trim((string) $this->caption))
            && !empty(trim((string) $this->call_to_action))
            && !empty(trim((string) $this->hashtags));
    }

    protected static function booted(): void
    {
        static::saving(function (self $slip) {
            $slip->is_complete = $slip->computeIsComplete();
        });
    }
}
