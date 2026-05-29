<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AutomationRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'created_by_user_id',
        'updated_by_user_id',
        'name',
        'trigger_key',
        'description',
        'condition_json',
        'action_json',
        'is_active',
    ];

    protected $casts = [
        'condition_json' => 'array',
        'action_json' => 'array',
        'is_active' => 'boolean',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    public function runs()
    {
        return $this->hasMany(AutomationRun::class);
    }
}
