<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStrategyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'marketing_objective' => ['nullable', 'string'],
            'target_audience' => ['nullable', 'string'],
            'key_message' => ['nullable', 'string'],
            'platforms' => ['nullable', 'array'],
            'platforms.*' => ['string', 'max:32'],
            'expected_kpis' => ['nullable', 'string'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date', 'after_or_equal:period_start'],
            'assigned_cm_id' => ['nullable', 'integer', 'exists:users,id'],
            'document_path' => ['nullable', 'string', 'max:2000'],
            'status' => ['sometimes', Rule::in(['draft', 'review', 'approved', 'archived'])],
            'version' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
