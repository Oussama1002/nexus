<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmBrief extends Model
{
    use HasFactory;

    protected $table = 'smm_briefs';

    protected $fillable = [
        'content_id', 'concept_intention', 'objective_result',
        'copy_text', 'script', 'expected_structure',
        'visual_direction', 'editing_structure', 'raw_material',
        'technical_instructions', 'references_text',
        'mandatory_info', 'call_to_action',
    ];

    public function content() { return $this->belongsTo(SmmContent::class, 'content_id'); }
}
