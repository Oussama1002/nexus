<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmVeilleTrend extends Model
{
    use HasFactory;

    protected $table = 'smm_veille_trends';

    protected $fillable = [
        'veille_note_id', 'brand_id', 'label', 'platform',
        'decision', 'reason',
        'filter_brand_relevance', 'filter_audience_relevance',
        'filter_positioning_coherence', 'filter_execution_effort_ok',
        'generated_content_id',
    ];

    protected $casts = [
        'filter_brand_relevance' => 'boolean',
        'filter_audience_relevance' => 'boolean',
        'filter_positioning_coherence' => 'boolean',
        'filter_execution_effort_ok' => 'boolean',
    ];

    public function veilleNote() { return $this->belongsTo(SmmVeilleNote::class, 'veille_note_id'); }
    public function brand() { return $this->belongsTo(Brand::class); }
    public function generatedContent() { return $this->belongsTo(SmmContent::class, 'generated_content_id'); }
}
