<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrOnboardingItem extends Model
{
    use HasFactory;

    protected $table = 'hr_onboarding_items';

    protected $fillable = [
        'brand_id',
        'employee_id',
        'item_key',
        'label',
        'is_completed',
        'completed_at',
        'completed_by_user_id',
        'notes',
    ];

    protected $casts = [
        'is_completed' => 'boolean',
        'completed_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function completedBy()
    {
        return $this->belongsTo(User::class, 'completed_by_user_id');
    }
}
