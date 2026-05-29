<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;

class SalaryVisibility
{
    public static function canViewSalary(Request $request): bool
    {
        $u = $request->user();
        if (! $u) {
            return false;
        }
        if ($u->isAdmin()) {
            return true;
        }

        return $u->hasPermissionSlug('finance.view') || $u->hasPermissionSlug('hr.view_salary');
    }
}
