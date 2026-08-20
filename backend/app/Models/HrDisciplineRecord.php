<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrDisciplineRecord extends Model
{
    use HasFactory;

    protected $table = 'hr_discipline_records';

    protected $fillable = [
        'brand_id',
        'employee_id',
        'incident_type',
        'incident_date',
        'incident_description',
        'sanction_type',
        'sanction_description',
        'status',
        'interview_at',
        'interview_notes',
        'decided_by_user_id',
        'decided_at',
        'notified_at',
        'acknowledged_at',
        'is_cancelled',
        'cancellation_reason',
        'cancelled_by_user_id',
        'cancelled_at',
        'notes',
    ];

    protected $casts = [
        'incident_date' => 'date',
        'interview_at' => 'datetime',
        'decided_at' => 'datetime',
        'notified_at' => 'datetime',
        'acknowledged_at' => 'datetime',
        'is_cancelled' => 'boolean',
        'cancelled_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function decidedBy()
    {
        return $this->belongsTo(User::class, 'decided_by_user_id');
    }

    public function cancelledBy()
    {
        return $this->belongsTo(User::class, 'cancelled_by_user_id');
    }
}
