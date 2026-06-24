<?php

namespace App\Models;

class Payment extends AcademyModel
{
    protected $fillable = [
        'uuid',
        'brand_id',
        'course_id',
        'enrollment_id',
        'student_id',
        'coupon_id',
        'payment_method',
        'payment_status',
        'order_number',
        'invoice_number',
        'transaction_reference',
        'amount',
        'currency',
        'gateway_payload',
        'paid_at',
        'validated_by',
        'validated_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'gateway_payload' => 'array',
        'paid_at' => 'datetime',
        'validated_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function enrollment()
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function coupon()
    {
        return $this->belongsTo(Coupon::class);
    }
}
