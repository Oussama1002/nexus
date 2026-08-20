<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmClientInsight extends Model
{
    use HasFactory;

    protected $table = 'smm_client_insights';

    protected $fillable = [
        'brand_id', 'source', 'insight_type', 'verbatim',
        'captured_on', 'observed_frequency',
        'complaint_id', 'status', 'exclusion_reason',
        'produced_content_ids_json',
        'captured_by_user_id', 'qualified_by_user_id', 'qualified_at',
    ];

    protected $casts = [
        'captured_on' => 'date',
        'observed_frequency' => 'integer',
        'produced_content_ids_json' => 'array',
        'qualified_at' => 'datetime',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function capturedBy() { return $this->belongsTo(User::class, 'captured_by_user_id'); }
    public function qualifiedBy() { return $this->belongsTo(User::class, 'qualified_by_user_id'); }
    public function contents() { return $this->belongsToMany(SmmContent::class, 'smm_content_insight', 'insight_id', 'content_id'); }
}
