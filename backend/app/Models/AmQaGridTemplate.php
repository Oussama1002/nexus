<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AmQaGridTemplate extends Model
{
    protected $fillable = ['deliverable_type', 'label', 'description', 'criteria_json', 'is_active'];
    protected $casts = ['criteria_json' => 'array', 'is_active' => 'bool'];
}
