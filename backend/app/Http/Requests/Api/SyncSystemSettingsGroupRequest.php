<?php

namespace App\Http\Requests\Api;

use App\Support\SystemSettingRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SyncSystemSettingsGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'setting_group' => ['required', 'string', Rule::in(SystemSettingRegistry::groupIds())],
            'settings' => ['required', 'array'],
            'settings.*' => ['nullable', 'string', 'max:65535'],
        ];
    }
}
