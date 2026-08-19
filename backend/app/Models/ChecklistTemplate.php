<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChecklistTemplate extends Model
{
    use HasFactory;

    protected $table = 'checklist_templates';

    protected $fillable = [
        'brand_id',
        'name',
        'description',
        'items_json',
        'is_default',
        'is_active',
    ];

    protected $casts = [
        'items_json' => 'array',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }
}
