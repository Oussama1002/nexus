<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CollabProjectDocument extends Model
{
    protected $fillable = [
        'project_id',
        'uploaded_by',
        'original_name',
        'storage_path',
        'mime_type',
        'size_bytes',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
    ];

    public function project()
    {
        return $this->belongsTo(CollabProject::class, 'project_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
