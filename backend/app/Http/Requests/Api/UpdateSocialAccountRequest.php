<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSocialAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'responsible_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'platform' => ['sometimes', Rule::in(['facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'other'])],
            'account_name' => ['sometimes', 'string', 'max:255'],
            'handle' => ['nullable', 'string', 'max:255'],
            'profile_url' => ['nullable', 'string', 'max:500'],
            'credential_ref' => ['nullable', 'string', 'max:5000'],
            'api_connected' => ['nullable', 'boolean'],
            'follower_count' => ['nullable', 'integer', 'min:0'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ];
    }
}
