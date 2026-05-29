<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClientPortalAccess extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'user_id',
        'enabled_widgets',
    ];

    protected $casts = [
        'enabled_widgets' => 'array',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
