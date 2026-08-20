<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmVeilleNote extends Model
{
    use HasFactory;

    protected $table = 'smm_veille_notes';

    protected $fillable = [
        'brand_id', 'author_user_id', 'week_start_date',
        'platforms_observed_json', 'platform_behavior_changes',
    ];

    protected $casts = [
        'week_start_date' => 'date',
        'platforms_observed_json' => 'array',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function author() { return $this->belongsTo(User::class, 'author_user_id'); }
    public function trends() { return $this->hasMany(SmmVeilleTrend::class, 'veille_note_id'); }
}
