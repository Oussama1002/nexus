<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBrandRequest extends FormRequest
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
        $id = $this->route('id');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['sometimes', 'string', 'max:50', Rule::unique('brands', 'code')->ignore($id)],
            'logo_url' => ['nullable', 'string', 'max:2048'],
            'color' => ['nullable', 'string', 'max:20'],
            'whatsapp_number' => ['nullable', 'array'],
            'whatsapp_number.*' => ['required', 'string', 'max:30'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ];
    }
}
