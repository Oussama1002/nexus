<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CollabProjectMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'user_id',
        'project_role',
        'is_lead',
    ];

    protected $casts = [
        'is_lead' => 'boolean',
    ];

    public function project()
    {
        return $this->belongsTo(CollabProject::class, 'project_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
