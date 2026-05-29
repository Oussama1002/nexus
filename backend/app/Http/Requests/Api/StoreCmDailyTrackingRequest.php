<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCmDailyTrackingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'work_date' => ['required', 'date'],
            'cm_user_id' => ['required', 'integer', 'exists:users,id'],
            'tasks_done' => ['nullable', 'integer', 'min:0'],
            'posts_done' => ['nullable', 'integer', 'min:0'],
            'stories_done' => ['nullable', 'integer', 'min:0'],
            'lives_done' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
            'tasks' => ['nullable', 'string'],
            'completed_actions' => ['nullable', 'string'],
            'completion_percentage' => ['nullable', 'integer', 'min:0', 'max:100'],
            'status' => ['nullable', Rule::in(['pending', 'submitted', 'validated', 'rejected'])],
        ];
    }
}
