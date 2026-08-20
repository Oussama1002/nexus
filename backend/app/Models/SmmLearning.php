<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmLearning extends Model
{
    use HasFactory;

    protected $table = 'smm_learnings';

    protected $fillable = [
        'brand_id', 'period', 'finding', 'dimension',
        'justifying_data', 'recommendation',
        'recipient_user_ids_json', 'communicated_at',
        'next_cycle_effect', 'author_user_id',
    ];

    protected $casts = [
        'recipient_user_ids_json' => 'array',
        'communicated_at' => 'datetime',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function author() { return $this->belongsTo(User::class, 'author_user_id'); }
}
