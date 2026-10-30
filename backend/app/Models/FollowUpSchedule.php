<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FollowUpSchedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'product_id',
        'offsets',
        'repeat_every_days',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'offsets' => 'array',
        'is_active' => 'boolean',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
