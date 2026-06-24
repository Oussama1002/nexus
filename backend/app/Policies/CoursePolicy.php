<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\User;

class CoursePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionSlug('academy_courses.view') || $user->hasPermissionSlug('hr.view');
    }

    public function view(User $user, Course $course): bool
    {
        return $user->hasPermissionSlug('academy_courses.view') || $user->hasPermissionSlug('hr.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionSlug('academy_courses.create') || $user->hasPermissionSlug('hr.update');
    }

    public function update(User $user, Course $course): bool
    {
        return $user->hasPermissionSlug('academy_courses.update') || $user->hasPermissionSlug('hr.update');
    }

    public function delete(User $user, Course $course): bool
    {
        return $user->hasPermissionSlug('academy_courses.delete') || $user->hasPermissionSlug('hr.delete');
    }

    public function publish(User $user, Course $course): bool
    {
        return $user->hasPermissionSlug('academy_courses.publish') || $user->hasPermissionSlug('hr.update');
    }

    public function archive(User $user, Course $course): bool
    {
        return $user->hasPermissionSlug('academy_courses.archive') || $user->hasPermissionSlug('hr.update');
    }
}
