<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AmHealthScoreConfig extends Model
{
    protected $fillable = ['brand_id', 'code', 'weights_json', 'components_json', 'is_active'];
    protected $casts = ['weights_json' => 'array', 'components_json' => 'array', 'is_active' => 'bool'];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
