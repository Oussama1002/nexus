<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMessageRequest extends FormRequest
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
            'direction' => ['required', Rule::in(['inbound', 'outbound'])],
            'content' => ['nullable', 'string'],
            'message_type' => ['nullable', 'string', 'max:50'],
            'external_message_id' => ['nullable', 'string', 'max:255'],
        ];
    }
}
