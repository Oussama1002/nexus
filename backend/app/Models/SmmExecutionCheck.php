<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmExecutionCheck extends Model
{
    use HasFactory;

    protected $table = 'smm_execution_checks';

    protected $fillable = [
        'brand_id', 'content_id', 'check_date',
        'checked_by_user_id', 'status',
        'has_public_impact', 'deviation_description',
        'correction_note', 'corrected_at',
        'escalated_to_direction', 'unpublished',
    ];

    protected $casts = [
        'check_date' => 'date',
        'has_public_impact' => 'boolean',
        'corrected_at' => 'datetime',
        'escalated_to_direction' => 'boolean',
        'unpublished' => 'boolean',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function content() { return $this->belongsTo(SmmContent::class, 'content_id'); }
    public function checkedBy() { return $this->belongsTo(User::class, 'checked_by_user_id'); }
}
