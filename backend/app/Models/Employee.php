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
    ];

    protected $casts = [
        'joined_at' => 'date',
        'all_brands' => 'boolean',
        'work_days_per_week' => 'integer',
        'work_days' => 'array',
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

    public function attendanceRecords()
    {
        return $this->hasMany(EmployeeAttendanceRecord::class);
    }
}
