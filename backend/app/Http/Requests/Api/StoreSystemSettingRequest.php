<?php

namespace App\Http\Requests\Api;

use App\Support\SystemSettingRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSystemSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'setting_key' => ['required', 'string', 'max:190'],
            'setting_group' => ['nullable', Rule::in(SystemSettingRegistry::groupIds())],
            'setting_value' => ['nullable', 'string'],
            'value_type' => ['nullable', 'string', 'max:50'],
            'is_sensitive' => ['boolean'],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }
}
