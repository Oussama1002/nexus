<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrCandidate extends Model
{
    use HasFactory;

    protected $table = 'hr_candidates';

    protected $fillable = [
        'brand_id',
        'job_opening_id',
        'full_name',
        'email',
        'phone',
        'city',
        'cv_url',
        'cover_letter_url',
        'source',
        'status',
        'notes',
        'refusal_reason',
        'contacted_at',
        'interview_at',
        'interview_notes',
        'interview_rating',
        'decided_by_user_id',
        'decided_at',
        'converted_employee_id',
    ];

    protected $casts = [
        'contacted_at' => 'datetime',
        'interview_at' => 'datetime',
        'interview_rating' => 'integer',
        'decided_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function jobOpening()
    {
        return $this->belongsTo(HrJobOpening::class, 'job_opening_id');
    }

    public function decidedBy()
    {
        return $this->belongsTo(User::class, 'decided_by_user_id');
    }

    public function convertedEmployee()
    {
        return $this->belongsTo(Employee::class, 'converted_employee_id');
    }
}
