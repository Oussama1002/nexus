<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmMonthlyReport extends Model
{
    use HasFactory;

    protected $table = 'smm_monthly_reports';

    protected $fillable = [
        'brand_id', 'year', 'month',
        'performance_summary',
        'winning_contents_json', 'underperforming_contents_json',
        'patterns_identified', 'decision_grid_json',
        'next_month_action_plan', 'status',
        'recipient_user_ids_json',
        'author_user_id', 'diffused_at', 'diffused_by_user_id',
    ];

    protected $casts = [
        'year' => 'integer',
        'month' => 'integer',
        'winning_contents_json' => 'array',
        'underperforming_contents_json' => 'array',
        'decision_grid_json' => 'array',
        'recipient_user_ids_json' => 'array',
        'diffused_at' => 'datetime',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function author() { return $this->belongsTo(User::class, 'author_user_id'); }
    public function diffusedBy() { return $this->belongsTo(User::class, 'diffused_by_user_id'); }
}
