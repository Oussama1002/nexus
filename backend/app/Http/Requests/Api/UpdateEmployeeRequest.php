<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'all_brands' => ['nullable', 'boolean'],
            'brand_ids' => ['nullable', 'array'],
            'brand_ids.*' => ['integer', 'exists:brands,id'],
            'employee_code' => ['sometimes', 'string', 'max:50'],
            'full_name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'department' => ['nullable', 'string', 'max:255'],
            'role_title' => ['nullable', 'string', 'max:255', 'exists:roles,slug'],
            'joined_at' => ['nullable', 'date'],
            'salary' => ['nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', Rule::in(['active', 'inactive', 'terminated'])],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            if (! $this->has('all_brands') && ! $this->has('brand_ids') && ! $this->has('brand_id')) {
                return;
            }
            if ($this->boolean('all_brands')) {
                return;
            }
            $ids = $this->input('brand_ids', []);
            if (is_array($ids) && count($ids) > 0) {
                return;
            }
            if ($this->filled('brand_id')) {
                return;
            }
            $v->errors()->add('brand_ids', 'Sélectionnez au moins une marque ou « Toutes les marques ».');
        });
    }
}
