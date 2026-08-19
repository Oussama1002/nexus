<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ComplaintThreadEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'complaint_id',
        'author_user_id',
        'entry_type',
        'content',
        'attachments',
    ];

    protected $casts = [
        'attachments' => 'array',
    ];

    public function complaint()
    {
        return $this->belongsTo(Complaint::class);
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }
}
