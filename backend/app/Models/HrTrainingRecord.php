<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrTrainingRecord extends Model
{
    use HasFactory;

    protected $table = 'hr_training_records';

    protected $fillable = [
        'brand_id',
        'employee_id',
        'title',
        'training_type',
        'provider',
        'start_date',
        'end_date',
        'duration_hours',
        'status',
        'result',
        'attestation_url',
        'description',
        'needs_identified_by',
        'requested_by_user_id',
        'notes',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'duration_hours' => 'integer',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function requestedBy()
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }
}
