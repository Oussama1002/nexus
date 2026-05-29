<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BrandUser extends Model
{
    public $timestamps = false;
    protected $table = 'brand_users';
    protected $fillable = ['brand_id', 'user_id'];
}
