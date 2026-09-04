<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ResetUserPasswordRequest;
use App\Http\Requests\Api\StoreUserRequest;
use App\Http\Requests\Api\UpdateUserRequest;
use App\Models\Employee;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->require($request, 'users.view');
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');
        $status = $request->query('status');

        $q = User::query()->with(['roles', 'brands'])->orderByDesc('id');
        if ($search) {
            $s = '%'.$search.'%';
            $q->where(function ($qq) use ($s) {
                $qq->where('name', 'like', $s)->orWhere('email', 'like', $s)->orWhere('phone', 'like', $s);
            });
        }
        if ($status) {
            $q->where('status', $status);
        }

        return ApiResponse::success($q->paginate($perPage), 'Users retrieved successfully.');
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $this->require($request, 'users.create');
        $data = $request->validated();
        $roleIds = $data['role_ids'];
        $brandIds = $data['brand_ids'] ?? [];

        $this->assertNonAdminCannotAssignAdminRole($request, $roleIds);
        $this->assertRolesBrandsRule($roleIds, $brandIds);

        unset($data['role_ids'], $data['brand_ids']);
        $data['status'] = $data['status'] ?? 'active';

        $employeeId = $data['employee_id'] ?? null;
        unset($data['employee_id']);

        $user = User::query()->create($data);
        $user->roles()->sync($roleIds);
        $user->brands()->sync($brandIds);

        if ($employeeId) {
            $employee = Employee::query()
                ->whereKey($employeeId)
                ->whereNull('user_id')
                ->first();
            if (! $employee) {
                abort(422, 'Employé introuvable ou déjà lié à un compte utilisateur.');
            }
            $employee->user_id = $user->id;
            $employee->save();
        }

        AuditService::log($request, 'users.create', $user, null, $user->fresh()->load(['roles', 'brands'])->toArray());

        return ApiResponse::success($user->fresh()->load(['roles.permissions', 'brands']), 'User created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->require($request, 'users.view');
        $user = User::query()->with(['roles.permissions', 'brands'])->findOrFail($id);
        $this->assertCanManageTarget($request, $user);

        $data = $user->toArray();

        $employee = \App\Models\Employee::query()->where('user_id', $user->id)->first();
        if ($employee) {
            $data['employee'] = [
                'id' => $employee->id,
                'full_name' => $employee->full_name,
                'role_title' => $employee->role_title,
                'department' => $employee->department,
                'work_start_time' => $employee->work_start_time,
                'work_end_time' => $employee->work_end_time,
                'work_days' => $employee->work_days,
            ];
            $data['attendance_history'] = $employee->attendanceRecords()
                ->orderByDesc('attendance_date')
                ->limit(30)
                ->get()
                ->toArray();
        } else {
            $data['employee'] = null;
            $data['attendance_history'] = [];
        }

        $data['recent_activity'] = \App\Models\AuditLog::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->toArray();

        $data['recent_messages'] = \App\Models\InternalMessage::query()
            ->where(function ($q) use ($user) {
                $q->where('sender_id', $user->id)
                  ->orWhere('receiver_id', $user->id);
            })
            ->with(['sender:id,name', 'receiver:id,name'])
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->toArray();

        return ApiResponse::success($data, 'User retrieved successfully.');
    }

    public function update(UpdateUserRequest $request, string $id): JsonResponse
    {
        $this->require($request, 'users.update');
        $user = User::query()->findOrFail($id);
        $this->assertCanManageTarget($request, $user);

        $before = $user->toArray();
        $data = $request->validated();

        if (isset($data['role_ids'])) {
            $this->assertNonAdminCannotAssignAdminRole($request, $data['role_ids']);
            $this->assertNotRemovingLastAdmin($user, $data['role_ids']);
            // CM spec §14.3 rule 3 — enforce CM + SMM role incompatibility
            // on update as well as on create.
            $newRoles = Role::query()->whereIn('id', $data['role_ids'])->pluck('slug')->all();
            if (in_array('community_manager', $newRoles, true) && in_array('smm', $newRoles, true)) {
                abort(422, "Un même utilisateur ne peut pas cumuler les rôles Community Manager et Social Media Manager.");
            }
            $user->roles()->sync($data['role_ids']);
            $user->refresh();
            $user->load('roles');
            if (! $user->isAdmin() && $user->brands()->count() < 1) {
                abort(422, 'Non-admin users must be assigned at least one brand.');
            }
            unset($data['role_ids']);
        }

        if (array_key_exists('brand_ids', $data)) {
            $brandIds = $data['brand_ids'] ?? [];
            $roleIds = $user->roles()->pluck('roles.id')->all();
            $this->assertRolesBrandsRule($roleIds, $brandIds);
            $user->brands()->sync($brandIds);
            unset($data['brand_ids']);
        }

        if (empty($data['password'] ?? null)) {
            unset($data['password']);
        }

        $user->fill($data);
        $user->save();

        AuditService::log($request, 'users.update', $user, $before, $user->fresh()->load(['roles', 'brands'])->toArray());

        return ApiResponse::success($user->fresh()->load(['roles.permissions', 'brands']), 'User updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->require($request, 'users.delete');
        $user = User::query()->findOrFail($id);
        $this->assertCanManageTarget($request, $user);

        if ($user->isAdmin()) {
            $adminCount = User::query()->whereHas('roles', fn ($q) => $q->where('slug', 'admin'))->count();
            if ($adminCount <= 1) {
                abort(422, 'Cannot delete the last administrator.');
            }
        }

        $before = $user->load(['roles', 'brands'])->toArray();
        $user->delete();

        AuditService::log($request, 'users.delete', null, $before, null);

        return ApiResponse::success(null, 'User deleted successfully.');
    }

    public function resetPassword(ResetUserPasswordRequest $request, string $id): JsonResponse
    {
        $this->require($request, 'users.update');
        $user = User::query()->findOrFail($id);
        $this->assertCanManageTarget($request, $user);

        $before = ['password_reset' => true];
        $user->password = $request->validated()['password'];
        $user->save();

        AuditService::log($request, 'users.password_reset', $user, $before, ['password_reset' => true]);

        return ApiResponse::success(null, 'Password updated successfully.');
    }

    /**
     * @param  array<int>  $roleIds
     * @param  array<int>  $brandIds
     */
    private function assertRolesBrandsRule(array $roleIds, array $brandIds): void
    {
        $roles = Role::query()->whereIn('id', $roleIds)->pluck('slug')->all();
        // CM spec §14.3 rule 3 — a single account cannot be both Community
        // Manager and Social Media Manager (would make the CM-A1 supervision
        // notification meaningless: a CM supervising themselves).
        if (in_array('community_manager', $roles, true) && in_array('smm', $roles, true)) {
            abort(422, "Un même utilisateur ne peut pas cumuler les rôles Community Manager et Social Media Manager.");
        }
        if (in_array('admin', $roles, true)) {
            return;
        }
        if (count($brandIds) < 1) {
            abort(422, 'Non-admin users must be assigned at least one brand.');
        }
    }

    /**
     * @param  array<int>  $roleIds
     */
    private function assertNonAdminCannotAssignAdminRole(Request $request, array $roleIds): void
    {
        if ($request->user()?->isAdmin()) {
            return;
        }
        $hasAdmin = Role::query()->whereIn('id', $roleIds)->where('slug', 'admin')->exists();
        if ($hasAdmin) {
            throw new AccessDeniedHttpException('Only administrators can assign the admin role.');
        }
    }

    /**
     * @param  array<int>  $newRoleIds
     */
    private function assertNotRemovingLastAdmin(User $user, array $newRoleIds): void
    {
        if (! $user->isAdmin()) {
            return;
        }
        $stillAdmin = Role::query()->whereIn('id', $newRoleIds)->where('slug', 'admin')->exists();
        if ($stillAdmin) {
            return;
        }
        $otherAdmins = User::query()
            ->where('id', '!=', $user->id)
            ->whereHas('roles', fn ($q) => $q->where('slug', 'admin'))
            ->count();
        if ($otherAdmins < 1) {
            abort(422, 'Cannot remove admin role from the last administrator.');
        }
    }

    private function assertCanManageTarget(Request $request, User $target): void
    {
        if ($request->user()?->isAdmin()) {
            return;
        }
        if ($target->isAdmin()) {
            throw new AccessDeniedHttpException('Only administrators can manage admin accounts.');
        }
    }

    private function require(Request $request, string $slug): void
    {
        if (! $request->user()?->hasPermissionSlug($slug)) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
