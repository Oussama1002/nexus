<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Brand extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'logo_url',
        'color',
        'whatsapp_number',
        'status',
    ];

    protected $casts = [
        'whatsapp_number' => 'array',
    ];

    public function users()
    {
        return $this->belongsToMany(User::class, 'brand_users');
    }

    public function leads()
    {
        return $this->hasMany(Lead::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function campaigns()
    {
        return $this->hasMany(Campaign::class);
    }
}
