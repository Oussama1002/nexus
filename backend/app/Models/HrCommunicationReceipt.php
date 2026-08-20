<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HrCommunicationReceipt extends Model
{
    use HasFactory;

    protected $table = 'hr_communication_receipts';

    protected $fillable = [
        'communication_id',
        'employee_id',
        'is_read',
        'read_at',
        'is_acknowledged',
        'acknowledged_at',
        'is_signed',
        'signed_at',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'read_at' => 'datetime',
        'is_acknowledged' => 'boolean',
        'acknowledged_at' => 'datetime',
        'is_signed' => 'boolean',
        'signed_at' => 'datetime',
    ];

    public function communication()
    {
        return $this->belongsTo(HrCommunication::class, 'communication_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
