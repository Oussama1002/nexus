<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmQcChecklist extends Model
{
    use HasFactory;

    protected $table = 'smm_qc_checklists';

    protected $fillable = [
        'content_id', 'completed_by_user_id',
        'items_json', 'is_complete', 'completed_at',
    ];

    protected $casts = [
        'items_json' => 'array',
        'is_complete' => 'boolean',
        'completed_at' => 'datetime',
    ];

    public function content() { return $this->belongsTo(SmmContent::class, 'content_id'); }
    public function completedBy() { return $this->belongsTo(User::class, 'completed_by_user_id'); }
}
