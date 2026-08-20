<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmContentRevision extends Model
{
    use HasFactory;

    protected $table = 'smm_content_revisions';

    protected $fillable = [
        'content_id', 'version_id', 'author_user_id',
        'feedback', 'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function content() { return $this->belongsTo(SmmContent::class, 'content_id'); }
    public function version() { return $this->belongsTo(SmmContentVersion::class, 'version_id'); }
    public function author() { return $this->belongsTo(User::class, 'author_user_id'); }
}
