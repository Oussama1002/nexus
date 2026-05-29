<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeAttendanceRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'employee_id',
        'user_id',
        'attendance_date',
        'clock_in_at',
        'clock_out_at',
        'status',
        'was_late',
        'minutes_late',
        'manager_marked_by_user_id',
        'manager_marked_at',
        'absent_notified_manager_at',
        'justification_status',
        'justification_reason',
        'justification_attachment_url',
        'payroll_impact',
    ];

    protected $casts = [
        'attendance_date' => 'date',
        'clock_in_at' => 'datetime',
        'clock_out_at' => 'datetime',
        'manager_marked_at' => 'datetime',
        'absent_notified_manager_at' => 'datetime',
        'was_late' => 'boolean',
        'payroll_impact' => 'decimal:2',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function managerMarkedBy()
    {
        return $this->belongsTo(User::class, 'manager_marked_by_user_id');
    }
}
