<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AmReportTemplate extends Model
{
    protected $fillable = ['code', 'label', 'sections_json', 'publishable_fields_whitelist', 'is_active'];
    protected $casts = [
        'sections_json' => 'array',
        'publishable_fields_whitelist' => 'array',
        'is_active' => 'bool',
    ];
}
