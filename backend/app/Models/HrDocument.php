<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrDocument extends Model
{
    use HasFactory;

    protected $table = 'hr_documents';

    protected $fillable = [
        'brand_id',
        'employee_id',
        'title',
        'document_type',
        'file_url',
        'file_size',
        'mime_type',
        'expiry_date',
        'is_signed',
        'signed_at',
        'uploaded_by_user_id',
        'notes',
    ];

    protected $casts = [
        'expiry_date' => 'date',
        'is_signed' => 'boolean',
        'signed_at' => 'datetime',
        'file_size' => 'integer',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function uploadedBy()
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id');
    }
}
