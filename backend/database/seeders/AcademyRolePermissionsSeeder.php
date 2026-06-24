<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class AcademyRolePermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $bySlug = fn (array $slugs) => Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();

        $assign = function (string $roleSlug, array $permissionSlugs) use ($bySlug): void {
            $role = Role::query()->where('slug', $roleSlug)->first();
            if (! $role) {
                return;
            }
            $role->permissions()->syncWithoutDetaching($bySlug($permissionSlugs));
        };

        $academyAll = Permission::query()
            ->where('module', 'like', 'academy_%')
            ->pluck('slug')
            ->all();

        $assign('super_admin', $academyAll);
        $assign('admin', $academyAll);
        $assign('academy_manager', [
            'academy_dashboard.view',
            'academy_courses.view', 'academy_courses.create', 'academy_courses.update', 'academy_courses.publish', 'academy_courses.archive',
            'academy_categories.view', 'academy_categories.create', 'academy_categories.update',
            'academy_students.view', 'academy_students.create', 'academy_students.update',
            'academy_trainers.view', 'academy_trainers.create', 'academy_trainers.update',
            'academy_enrollments.view', 'academy_enrollments.create', 'academy_enrollments.update', 'academy_enrollments.bulk_enroll', 'academy_enrollments.manual_enroll',
            'academy_progress.view', 'academy_progress.update',
            'academy_quizzes.view', 'academy_quizzes.create', 'academy_quizzes.update', 'academy_quizzes.grade',
            'academy_certificates.view', 'academy_certificates.create', 'academy_certificates.download', 'academy_certificates.verify',
            'academy_reviews.view', 'academy_reviews.moderate',
            'academy_announcements.view', 'academy_announcements.create', 'academy_announcements.update',
            'academy_live_sessions.view', 'academy_live_sessions.create', 'academy_live_sessions.update', 'academy_live_sessions.attendance',
            'academy_payments.view', 'academy_payments.update', 'academy_payments.validate',
            'academy_coupons.view', 'academy_coupons.create', 'academy_coupons.update',
            'academy_notifications.view', 'academy_notifications.create', 'academy_notifications.send',
            'academy_reports.view', 'academy_reports.export',
        ]);

        $assign('trainer', [
            'academy_dashboard.view',
            'academy_courses.view',
            'academy_quizzes.view', 'academy_quizzes.create', 'academy_quizzes.update', 'academy_quizzes.grade',
            'academy_announcements.view', 'academy_announcements.create',
            'academy_live_sessions.view', 'academy_live_sessions.create', 'academy_live_sessions.update', 'academy_live_sessions.attendance',
            'academy_students.view',
            'academy_progress.view', 'academy_progress.update',
            'academy_reports.view',
        ]);

        $assign('student', [
            'academy_dashboard.view',
            'academy_courses.view',
            'academy_enrollments.view',
            'academy_progress.view',
            'academy_quizzes.view', 'academy_quizzes.attempt',
            'academy_certificates.view', 'academy_certificates.download', 'academy_certificates.verify',
            'academy_reviews.view', 'academy_reviews.create', 'academy_reviews.update',
            'academy_notifications.view',
            'academy_live_sessions.view',
        ]);

        $assign('sales_agent', [
            'academy_dashboard.view',
            'academy_courses.view',
            'academy_students.view', 'academy_students.create', 'academy_students.update',
            'academy_enrollments.view', 'academy_enrollments.create', 'academy_enrollments.manual_enroll', 'academy_enrollments.bulk_enroll',
            'academy_payments.view', 'academy_payments.create',
            'academy_coupons.view',
            'academy_reports.view',
        ]);

        $assign('support_agent', [
            'academy_dashboard.view',
            'academy_courses.view',
            'academy_students.view',
            'academy_enrollments.view',
            'academy_progress.view',
            'academy_certificates.view', 'academy_certificates.verify',
            'academy_notifications.view', 'academy_notifications.send',
            'academy_live_sessions.view',
            'academy_reports.view',
        ]);
    }
}
