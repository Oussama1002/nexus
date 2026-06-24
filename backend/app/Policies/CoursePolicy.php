<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\User;

class CoursePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionSlug('academy_courses.view');
    }

    public function view(User $user, Course $course): bool
    {
        return $user->hasPermissionSlug('academy_courses.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionSlug('academy_courses.create');
    }

    public function update(User $user, Course $course): bool
    {
        return $user->hasPermissionSlug('academy_courses.update');
    }

    public function delete(User $user, Course $course): bool
    {
        return $user->hasPermissionSlug('academy_courses.delete');
    }

    public function publish(User $user, Course $course): bool
    {
        return $user->hasPermissionSlug('academy_courses.publish');
    }

    public function archive(User $user, Course $course): bool
    {
        return $user->hasPermissionSlug('academy_courses.archive');
    }
}
