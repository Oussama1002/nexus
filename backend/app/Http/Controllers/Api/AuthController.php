<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AttendanceService;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()
            ->where('email', $validated['email'])
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->status !== 'active') {
            return ApiResponse::error('Your account is not active.', null, 403);
        }

        $user->tokens()->delete();
        $token = $user->createToken('api')->plainTextToken;

        AuditLogger::log($request, 'auth.login', $user, null, [
            'email' => $user->email,
        ]);

        $attendance = (new AttendanceService())->recordLoginAttendance($user);

        $payload = $this->authPayload($user, $token);
        if ($attendance) {
            $payload['attendance'] = [
                'status' => $attendance->status,
                'clock_in_at' => $attendance->clock_in_at?->format('H:i'),
                'was_late' => $attendance->was_late,
                'minutes_late' => $attendance->minutes_late,
            ];
        }

        return ApiResponse::success($payload, 'Logged in successfully.');
    }

    public function logout(Request $request): JsonResponse
    {
        $actor = $request->user();
        if ($actor) {
            AuditLogger::log($request, 'auth.logout', $actor, null, [
                'email' => $actor->email,
            ]);
            $actor->currentAccessToken()?->delete();
        }

        return ApiResponse::success(null, 'Logged out successfully.');
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing(['roles.permissions', 'brands']);

        return ApiResponse::success($this->userPayload($user), 'User retrieved successfully.');
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $before = $user->only(['name', 'phone']);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
        ]);

        $user->update($data);

        AuditLogger::log($request, 'profile.update', $user, $before, $user->fresh()->only(['name', 'phone']));

        return ApiResponse::success($this->userPayload($user->fresh()->loadMissing(['roles.permissions', 'brands'])), 'Profil mis à jour.');
    }

    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => ['required', 'file', 'max:2048', 'mimes:jpg,jpeg,png,gif,webp'],
        ]);

        $user = $request->user();
        $before = ['avatar_url' => $user->avatar_url];

        $dir = "avatars/{$user->id}";
        Storage::disk('public')->deleteDirectory($dir);
        $path = $request->file('avatar')->storeAs($dir, 'avatar.'.$request->file('avatar')->extension(), 'public');
        $url = '/storage/'.$path;

        $user->update(['avatar_url' => $url]);

        AuditLogger::log($request, 'profile.avatar_upload', $user, $before, ['avatar_url' => $url]);

        return ApiResponse::success(['avatar_url' => $url], 'Photo de profil mise à jour.');
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return ApiResponse::error('Le mot de passe actuel est incorrect.', null, 422);
        }

        $user->update(['password' => Hash::make($data['password'])]);

        return ApiResponse::success(null, 'Mot de passe modifié.');
    }

    /**
     * @return array<string, mixed>
     */
    protected function authPayload(User $user, string $token): array
    {
        $user->loadMissing(['roles.permissions', 'brands']);

        return [
            'token' => $token,
            'token_type' => 'Bearer',
            ...$this->userPayload($user),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function userPayload(User $user): array
    {
        $roles = $user->roles->map(fn ($role) => [
            'id' => $role->id,
            'name' => $role->name,
            'slug' => $role->slug,
            'landing_view' => $role->landing_view,
        ])->values();

        // Spec Phase 1 §7.3 — user's home screen is the first role's landing_view
        // that is defined; falls back to 'dashboard' when no role sets one.
        $landingView = $user->roles->pluck('landing_view')->filter()->first() ?? 'dashboard';

        $permissions = $user->roles
            ->flatMap(fn ($role) => $role->permissions)
            ->unique('id')
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->name,
                'slug' => $p->slug,
                'module' => $p->module,
            ])
            ->values();

        $brands = $user->brands->map(fn ($brand) => [
            'id' => $brand->id,
            'name' => $brand->name,
            'code' => $brand->code,
            'status' => $brand->status,
            'whatsapp_number' => $brand->whatsapp_number,
        ])->values();

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar_url' => $user->avatar_url,
                'status' => $user->status,
            ],
            'roles' => $roles,
            'permissions' => $permissions,
            'brands' => $brands,
            'landing_view' => $landingView,
        ];
    }
}
