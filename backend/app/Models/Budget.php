<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Budget extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id', 'name', 'department', 'period_label',
        'period_start', 'period_end', 'allocated', 'status',
        'notes', 'created_by_user_id',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'allocated' => 'decimal:2',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function requests() { return $this->hasMany(BudgetRequest::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by_user_id'); }
}
