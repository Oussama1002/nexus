<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CollabProject extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'created_by_user_id',
        'title',
        'objective',
        'status',
        'due_date',
        'asset_url',
        'notes',
    ];

    protected $casts = [
        'due_date' => 'date',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function members()
    {
        return $this->hasMany(CollabProjectMember::class, 'project_id');
    }
}
