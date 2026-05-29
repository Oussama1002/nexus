<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAdAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'platform' => ['sometimes', Rule::in(['meta', 'tiktok', 'google', 'snap', 'linkedin', 'other'])],
            'account_name' => ['sometimes', 'string', 'max:255'],
            'responsible_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'external_account_id' => ['nullable', 'string', 'max:255'],
            'business_manager_id' => ['nullable', 'string', 'max:128'],
            'access_token_ref' => ['nullable', 'string', 'max:500'],
            'refresh_token_ref' => ['nullable', 'string', 'max:500'],
            'webhook_secret_ref' => ['nullable', 'string', 'max:500'],
            'currency' => ['nullable', 'string', 'max:10'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'country' => ['nullable', 'string', 'max:8'],
            'api_connected' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'suspended', 'expired'])],
            'notes' => ['nullable', 'string'],
        ];
    }
}
