<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBrandRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', 'unique:brands,code'],
            'logo_url' => ['nullable', 'string', 'max:2048'],
            'color' => ['nullable', 'string', 'max:20'],
            'whatsapp_number' => ['nullable', 'array'],
            'whatsapp_number.*' => ['required', 'string', 'max:30'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ];
    }
}
