<?php

namespace App\Policies;

use App\Models\Student;
use App\Models\User;

class StudentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionSlug('academy_students.view');
    }

    public function view(User $user, Student $student): bool
    {
        return $user->hasPermissionSlug('academy_students.view');
    }

    public function update(User $user, Student $student): bool
    {
        return $user->hasPermissionSlug('academy_students.update');
    }
}
