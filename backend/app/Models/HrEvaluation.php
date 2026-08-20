<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrEvaluation extends Model
{
    use HasFactory;

    protected $table = 'hr_evaluations';

    protected $fillable = [
        'brand_id',
        'campaign_id',
        'employee_id',
        'evaluator_user_id',
        'objectives_json',
        'results_json',
        'manager_appreciation',
        'overall_rating',
        'employee_comment',
        'recommendation',
        'status',
        'interview_at',
        'signed_by_employee_at',
        'signed_by_manager_at',
        'finalized_at',
        'notes',
    ];

    protected $casts = [
        'objectives_json' => 'array',
        'results_json' => 'array',
        'overall_rating' => 'integer',
        'interview_at' => 'datetime',
        'signed_by_employee_at' => 'datetime',
        'signed_by_manager_at' => 'datetime',
        'finalized_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function campaign()
    {
        return $this->belongsTo(HrEvaluationCampaign::class, 'campaign_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function evaluator()
    {
        return $this->belongsTo(User::class, 'evaluator_user_id');
    }

    public function careerEvents()
    {
        return $this->hasMany(HrCareerEvent::class, 'evaluation_id');
    }
}
