<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'whatsapp_number_id',
        'customer_id',
        'lead_id',
        'assigned_user_id',
        'channel',
        'external_thread_id',
        'status',
        'last_message_at',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function whatsappNumber()
    {
        return $this->belongsTo(WhatsAppNumber::class, 'whatsapp_number_id');
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function lead()
    {
        return $this->belongsTo(Lead::class);
    }

    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }

    public function latestMessage()
    {
        return $this->hasOne(Message::class)->orderByDesc('sent_at')->orderByDesc('id');
    }

    public function reminders()
    {
        return $this->hasMany(Reminder::class);
    }
}
