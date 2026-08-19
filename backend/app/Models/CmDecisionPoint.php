<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CmDecisionPoint extends Model
{
    use HasFactory;

    protected $table = 'cm_decision_points';

    protected $fillable = [
        'brand_id',
        'cm_user_id',
        'decision_code',
        'decision_label',
        'context_type',
        'context_id',
        'input_data',
        'output_data',
        'result',
        'notes',
    ];

    protected $casts = [
        'input_data' => 'array',
        'output_data' => 'array',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function cmUser()
    {
        return $this->belongsTo(User::class, 'cm_user_id');
    }
}
