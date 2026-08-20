<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrPayrollBulletin extends Model
{
    use HasFactory;

    protected $table = 'hr_payroll_bulletins';

    protected $fillable = [
        'brand_id',
        'payroll_period_id',
        'employee_id',
        'base_salary',
        'days_worked',
        'days_absent_unjustified',
        'days_absent_justified',
        'days_leave',
        'overtime_hours',
        'overtime_amount',
        'primes',
        'indemnites',
        'retenues',
        'absence_deduction',
        'cnss_employee',
        'ir',
        'net_salary',
        'details_json',
        'notes',
        'status',
        'validated_by_user_id',
        'validated_at',
    ];

    protected $casts = [
        'base_salary' => 'decimal:2',
        'days_worked' => 'integer',
        'days_absent_unjustified' => 'integer',
        'days_absent_justified' => 'integer',
        'days_leave' => 'integer',
        'overtime_hours' => 'decimal:2',
        'overtime_amount' => 'decimal:2',
        'primes' => 'decimal:2',
        'indemnites' => 'decimal:2',
        'retenues' => 'decimal:2',
        'absence_deduction' => 'decimal:2',
        'cnss_employee' => 'decimal:2',
        'ir' => 'decimal:2',
        'net_salary' => 'decimal:2',
        'details_json' => 'array',
        'validated_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function payrollPeriod()
    {
        return $this->belongsTo(HrPayrollPeriod::class, 'payroll_period_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function validatedBy()
    {
        return $this->belongsTo(User::class, 'validated_by_user_id');
    }
}
