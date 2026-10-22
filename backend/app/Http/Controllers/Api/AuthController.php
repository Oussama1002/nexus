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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);
        $user = User::query()->where('email', $data['email'])->first();

        // Same answer whether the account exists or not, so the form can't be
        // used to probe which e-mails are registered.
        $generic = 'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.';

        if (! $user || $user->status !== 'active') {
            return ApiResponse::success(null, $generic);
        }

        $token = Password::broker()->createToken($user);
        $base = rtrim((string) ($request->headers->get('origin') ?: config('app.url')), '/');
        $link = $base.'/reset-password?token='.urlencode($token).'&email='.urlencode($user->email);

        // Brand SMTP from Paramètres → Intégrations: the user's brand first,
        // then any brand that has one, else the .env mailer.
        $brandMailer = app(\App\Services\BrandMailer::class);
        $brandId = $user->brands()->pluck('brands.id')
            ->merge(\App\Models\SystemSetting::query()->where('setting_key', 'smtp_host')->where('setting_value', '!=', '')->pluck('brand_id'))
            ->first(fn ($id) => $id && $brandMailer->settings((int) $id));

        $safeName = e($user->name);
        $safeLink = e($link);
        $html = <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f5f2;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f2;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:480px;max-width:92%;background:#ffffff;border:1px solid #efebe4;border-radius:18px;overflow:hidden;">
        <tr><td style="height:4px;background:#b08d57;line-height:4px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 36px 4px 36px;font-family:Inter,Arial,Helvetica,sans-serif;">
          <div style="font-size:18px;font-weight:600;color:#1a1714;letter-spacing:-0.01em;">Brandna <span style="color:#b08d57;">CRM</span></div>
        </td></tr>
        <tr><td style="padding:16px 36px 0 36px;font-family:Inter,Arial,Helvetica,sans-serif;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1a1714;letter-spacing:-0.01em;">Réinitialisation du mot de passe</h1>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#1a1714;">Bonjour {$safeName},</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#6b635b;">Vous avez demandé à réinitialiser votre mot de passe du CRM. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Ce lien est valable <strong style="color:#1a1714;">60 minutes</strong>.</p>
        </td></tr>
        <tr><td align="center" style="padding:0 36px 8px 36px;">
          <a href="{$safeLink}" style="display:inline-block;background:#1a1714;color:#ffffff;font-family:Inter,Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:14px 30px;border-radius:12px;">Choisir un nouveau mot de passe</a>
        </td></tr>
        <tr><td style="padding:20px 36px 0 36px;font-family:Inter,Arial,Helvetica,sans-serif;">
          <p style="margin:0 0 6px;font-size:12px;color:#9a9089;">Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :</p>
          <p style="margin:0 0 24px;font-size:12px;word-break:break-all;"><a href="{$safeLink}" style="color:#957346;text-decoration:none;">{$safeLink}</a></p>
          <hr style="border:none;border-top:1px solid #efebe4;margin:0 0 16px;">
          <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:#9a9089;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.</p>
        </td></tr>
        <tr><td style="padding:0 36px 28px 36px;font-family:Inter,Arial,Helvetica,sans-serif;">
          <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#c9c0b6;">Brandna CRM</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;

        try {
            $brandMailer->for($brandId ? (int) $brandId : null)->html(
                $html,
                fn ($m) => $m->to($user->email)->subject('Réinitialisation de votre mot de passe')
            );
        } catch (\Throwable $e) {
            Log::error('auth.password_reset.mail_failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);

            return ApiResponse::error('Impossible d’envoyer l’e-mail pour le moment. Vérifiez la configuration e-mail (Paramètres → Intégrations) ou contactez un administrateur.', null, 500);
        }

        AuditLogger::log($request, 'auth.password_reset_requested', $user, null, ['email' => $user->email]);

        return ApiResponse::success(null, $generic);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'Les deux mots de passe ne correspondent pas.',
        ]);

        $resetUser = null;
        $status = Password::broker()->reset($data, function (User $user, string $password) use (&$resetUser) {
            $user->forceFill(['password' => Hash::make($password)])->save();
            $user->tokens()->delete();
            $resetUser = $user;
        });

        if ($status !== Password::PASSWORD_RESET) {
            return ApiResponse::error('Lien invalide ou expiré. Refaites une demande de réinitialisation.', null, 422);
        }

        // Feeds the admins' notification ("mot de passe réinitialisé").
        AuditLogger::system('auth.password_reset', $resetUser, ['name' => $resetUser?->name, 'email' => $resetUser?->email]);

        return ApiResponse::success(null, 'Mot de passe modifié. Vous pouvez vous connecter.');
    }

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

        // Casse et espaces parasites ne doivent pas bloquer une connexion.
        if (strtolower(trim((string) $user->status)) !== 'active') {
            return ApiResponse::error(
                "Ce compte est désactivé (statut « {$user->status} »). Demandez à un administrateur de le réactiver.",
                null,
                403,
            );
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
                'id' => $attendance->id,
                'status' => $attendance->status,
                'clock_in_at' => $attendance->clock_in_at?->copy()->setTimezone(AttendanceService::TIMEZONE)->format('H:i'),
                'was_late' => $attendance->was_late,
                'minutes_late' => $attendance->minutes_late,
                'justification_reason' => $attendance->justification_reason,
                'justification_status' => $attendance->justification_status,
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
            (new AttendanceService())->recordLogout($actor);
            $actor->currentAccessToken()?->delete();
        }

        return ApiResponse::success(null, 'Logged out successfully.');
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing(['roles.permissions', 'brands']);

        // Tokens don't expire, so someone who stays logged in never hits
        // /login again: clock them in on their first app load of the day.
        (new AttendanceService())->recordLoginAttendance($user);

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
