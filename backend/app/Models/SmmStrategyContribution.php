<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmStrategyContribution extends Model
{
    use HasFactory;

    protected $table = 'smm_strategy_contributions';

    protected $fillable = [
        'strategy_id', 'contributor_user_id', 'role_at_time',
        'requested_at', 'received_at', 'contribution',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'received_at' => 'datetime',
    ];

    public function strategy() { return $this->belongsTo(SmmStrategy::class, 'strategy_id'); }
    public function contributor() { return $this->belongsTo(User::class, 'contributor_user_id'); }
}
