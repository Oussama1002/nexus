<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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

        return ApiResponse::success($this->authPayload($user, $token), 'Logged in successfully.');
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
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
        ]);

        $user->update($data);

        return ApiResponse::success($this->userPayload($user->fresh()->loadMissing(['roles.permissions', 'brands'])), 'Profil mis à jour.');
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
        ])->values();

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
                'status' => $user->status,
            ],
            'roles' => $roles,
            'permissions' => $permissions,
            'brands' => $brands,
        ];
    }
}
