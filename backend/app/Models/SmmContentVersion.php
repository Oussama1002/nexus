<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmContentVersion extends Model
{
    use HasFactory;

    protected $table = 'smm_content_versions';

    protected $fillable = [
        'content_id', 'uploaded_by_user_id', 'version_number',
        'file_url', 'file_type', 'file_size', 'notes',
    ];

    protected $casts = [
        'version_number' => 'integer',
        'file_size' => 'integer',
    ];

    public function content() { return $this->belongsTo(SmmContent::class, 'content_id'); }
    public function uploadedBy() { return $this->belongsTo(User::class, 'uploaded_by_user_id'); }
    public function revisions() { return $this->hasMany(SmmContentRevision::class, 'version_id'); }
}
