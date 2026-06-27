<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreEmployeeRequest extends FormRequest
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
            'employee_code' => ['nullable', 'string', 'max:50', 'unique:employees,employee_code'],
            'full_name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'department' => ['nullable', 'string', 'max:255'],
            'role_title' => ['nullable', 'string', 'max:255'],
            'joined_at' => ['nullable', 'date'],
            'salary' => ['nullable', 'numeric', 'min:0'],
            'work_start_time' => ['nullable', 'date_format:H:i'],
            'work_end_time' => ['nullable', 'date_format:H:i'],
            'work_days_per_week' => ['nullable', 'integer', 'min:1', 'max:7'],
            'work_days' => ['nullable', 'array'],
            'work_days.*' => ['string', Rule::in(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'])],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'terminated'])],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
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
