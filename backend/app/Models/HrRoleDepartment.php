<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrRoleDepartment extends Model
{
    protected $fillable = [
        'role_title',
        'department',
    ];
}
