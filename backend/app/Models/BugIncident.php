<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BugIncident extends Model
{
    use HasFactory;

    protected $table = 'bugs_incidents';

    protected $fillable = [
        'brand_id', 'title', 'description', 'severity', 'module',
        'reporter_user_id', 'assignee_user_id', 'status',
        'resolution', 'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function reporter() { return $this->belongsTo(User::class, 'reporter_user_id'); }
    public function assignee() { return $this->belongsTo(User::class, 'assignee_user_id'); }
}
