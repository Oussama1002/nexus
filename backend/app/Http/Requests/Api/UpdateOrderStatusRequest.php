<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderStatusRequest extends FormRequest
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
            'status' => ['required', Rule::in(['draft', 'pending', 'confirmed', 'cancelled', 'returned', 'delivered', 'other'])],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
