<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrLookupValue extends Model
{
    public const TYPE_DEPARTMENT = 'department';

    public const TYPE_ROLE_TITLE = 'role_title';

    protected $fillable = [
        'brand_id',
        'type',
        'value',
    ];

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
