<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContentProduction extends Model
{
    use HasFactory;

    protected $table = 'content_production';

    protected $fillable = [
        'brand_id',
        'content_calendar_id',
        'owner_user_id',
        'title',
        'location',
        'production_type',
        'asset_path',
        'equipment_notes',
        'crew_notes',
        'status',
        'shoot_date',
    ];

    protected $casts = [
        'shoot_date' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function contentCalendar()
    {
        return $this->belongsTo(ContentCalendar::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }
}
