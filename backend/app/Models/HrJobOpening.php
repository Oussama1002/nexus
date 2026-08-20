<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrJobOpening extends Model
{
    use HasFactory;

    protected $table = 'hr_job_openings';

    protected $fillable = [
        'brand_id',
        'title',
        'department',
        'description',
        'requirements',
        'contract_type',
        'location',
        'salary_min',
        'salary_max',
        'status',
        'positions_count',
        'created_by_user_id',
        'published_at',
        'closed_at',
    ];

    protected $casts = [
        'salary_min' => 'decimal:2',
        'salary_max' => 'decimal:2',
        'positions_count' => 'integer',
        'published_at' => 'date',
        'closed_at' => 'date',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function candidates()
    {
        return $this->hasMany(HrCandidate::class, 'job_opening_id');
    }
}
