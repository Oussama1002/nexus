<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Complaint extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'reference',
        'customer_name',
        'customer_phone',
        'customer_handle',
        'channel',
        'category',
        'priority',
        'description',
        'status',
        'source_user_id',
        'source',
        'assigned_user_id',
        'resolution_notes',
        'resolved_at',
        'closed_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function sourceUser()
    {
        return $this->belongsTo(User::class, 'source_user_id');
    }

    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function threadEntries()
    {
        return $this->hasMany(ComplaintThreadEntry::class)->orderBy('created_at');
    }
}
