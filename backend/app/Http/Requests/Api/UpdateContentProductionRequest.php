<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateContentProductionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'content_calendar_id' => ['nullable', 'integer', 'exists:content_calendar,id'],
            'owner_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'title' => ['sometimes', 'string', 'max:255'],
            'production_type' => ['sometimes', Rule::in(['shooting', 'editing', 'design', 'copywriting', 'live_preparation'])],
            'location' => ['nullable', 'string', 'max:255'],
            'equipment_notes' => ['nullable', 'string'],
            'crew_notes' => ['nullable', 'string'],
            'asset_path' => ['nullable', 'string', 'max:2000'],
            'status' => ['sometimes', Rule::in(['todo', 'in_progress', 'submitted', 'validated', 'rejected'])],
            'shoot_date' => ['nullable', 'date'],
        ];
    }
}
