<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrPayrollPeriod extends Model
{
    use HasFactory;

    protected $table = 'hr_payroll_periods';

    protected $fillable = [
        'brand_id',
        'year',
        'month',
        'status',
        'validated_by_user_id',
        'validated_at',
    ];

    protected $casts = [
        'year' => 'integer',
        'month' => 'integer',
        'validated_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function validatedBy()
    {
        return $this->belongsTo(User::class, 'validated_by_user_id');
    }

    public function bulletins()
    {
        return $this->hasMany(HrPayrollBulletin::class, 'payroll_period_id');
    }
}
