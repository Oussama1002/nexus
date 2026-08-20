<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrCareerEvent extends Model
{
    use HasFactory;

    protected $table = 'hr_career_events';

    protected $fillable = [
        'brand_id',
        'employee_id',
        'event_type',
        'effective_date',
        'old_value',
        'new_value',
        'description',
        'evaluation_id',
        'decided_by_user_id',
        'notes',
    ];

    protected $casts = [
        'effective_date' => 'date',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function evaluation()
    {
        return $this->belongsTo(HrEvaluation::class, 'evaluation_id');
    }

    public function decidedBy()
    {
        return $this->belongsTo(User::class, 'decided_by_user_id');
    }
}
