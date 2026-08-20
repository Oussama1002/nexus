<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'brand_id',
        'all_brands',
        'employee_code',
        'full_name',
        'phone',
        'department',
        'role_title',
        'joined_at',
        'status',
        'salary',
        'work_start_time',
        'work_end_time',
        'lunch_start_time',
        'lunch_end_time',
        'work_days_per_week',
        'work_days',
        // New spec fields
        'cin',
        'cnss_number',
        'birth_date',
        'gender',
        'marital_status',
        'children_count',
        'address',
        'city',
        'email',
        'emergency_contact_name',
        'emergency_contact_phone',
        'contract_type',
        'contract_start_date',
        'contract_end_date',
        'trial_end_date',
        'rib',
        'leave_balance_days',
        'leave_accrual_rate',
        'manager_employee_id',
        'onboarding_status',
        'onboarding_completed_at',
        'departure_date',
        'departure_reason',
        'notes',
    ];

    protected $casts = [
        'joined_at' => 'date',
        'all_brands' => 'boolean',
        'work_days_per_week' => 'integer',
        'work_days' => 'array',
        'birth_date' => 'date',
        'children_count' => 'integer',
        'contract_start_date' => 'date',
        'contract_end_date' => 'date',
        'trial_end_date' => 'date',
        'leave_balance_days' => 'decimal:1',
        'leave_accrual_rate' => 'decimal:2',
        'onboarding_completed_at' => 'datetime',
        'departure_date' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function brands()
    {
        return $this->belongsToMany(Brand::class, 'employee_brand');
    }

    public function manager()
    {
        return $this->belongsTo(Employee::class, 'manager_employee_id');
    }

    public function subordinates()
    {
        return $this->hasMany(Employee::class, 'manager_employee_id');
    }

    public function attendanceRecords()
    {
        return $this->hasMany(EmployeeAttendanceRecord::class);
    }

    public function leaveRequests()
    {
        return $this->hasMany(HrLeaveRequest::class);
    }

    public function onboardingItems()
    {
        return $this->hasMany(HrOnboardingItem::class);
    }

    public function payrollBulletins()
    {
        return $this->hasMany(HrPayrollBulletin::class);
    }

    public function trainingRecords()
    {
        return $this->hasMany(HrTrainingRecord::class);
    }

    public function evaluations()
    {
        return $this->hasMany(HrEvaluation::class);
    }

    public function careerEvents()
    {
        return $this->hasMany(HrCareerEvent::class);
    }

    public function disciplineRecords()
    {
        return $this->hasMany(HrDisciplineRecord::class);
    }

    public function documents()
    {
        return $this->hasMany(HrDocument::class);
    }
}
