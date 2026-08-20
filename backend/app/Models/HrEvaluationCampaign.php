<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrEvaluationCampaign extends Model
{
    use HasFactory;

    protected $table = 'hr_evaluation_campaigns';

    protected $fillable = [
        'brand_id',
        'title',
        'year',
        'period',
        'start_date',
        'end_date',
        'status',
        'created_by_user_id',
        'notes',
    ];

    protected $casts = [
        'year' => 'integer',
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function evaluations()
    {
        return $this->hasMany(HrEvaluation::class, 'campaign_id');
    }
}
