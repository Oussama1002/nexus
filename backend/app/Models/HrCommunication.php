<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrCommunication extends Model
{
    use HasFactory;

    protected $table = 'hr_communications';

    protected $fillable = [
        'brand_id',
        'title',
        'comm_type',
        'content',
        'attachment_url',
        'requires_acknowledgment',
        'requires_signature',
        'target_audience',
        'target_departments_json',
        'target_employee_ids_json',
        'status',
        'published_by_user_id',
        'published_at',
    ];

    protected $casts = [
        'requires_acknowledgment' => 'boolean',
        'requires_signature' => 'boolean',
        'target_departments_json' => 'array',
        'target_employee_ids_json' => 'array',
        'published_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function publishedBy()
    {
        return $this->belongsTo(User::class, 'published_by_user_id');
    }

    public function receipts()
    {
        return $this->hasMany(HrCommunicationReceipt::class, 'communication_id');
    }
}
