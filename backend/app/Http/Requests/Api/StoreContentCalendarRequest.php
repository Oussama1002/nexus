<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreContentCalendarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'social_account_id' => ['nullable', 'integer', 'exists:social_accounts,id'],
            'platform' => ['nullable', 'string', 'max:32'],
            'strategy_id' => ['nullable', 'integer', 'exists:strategies,id'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'content_type' => ['required', Rule::in(['post', 'story', 'reel', 'live', 'video', 'carousel'])],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'caption' => ['nullable', 'string'],
            'attachments_json' => ['nullable', 'array'],
            'planned_at' => ['nullable', 'date'],
            'published_at' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['draft', 'planned', 'in_production', 'review', 'approved', 'published', 'cancelled'])],
        ];
    }
}
