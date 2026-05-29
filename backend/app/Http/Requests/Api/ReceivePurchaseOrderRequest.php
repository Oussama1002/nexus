<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class ReceivePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'lines' => ['nullable', 'array'],
            'lines.*.line_id' => ['required_with:lines', 'integer'],
            'lines.*.quantity' => ['required_with:lines', 'integer', 'min:0'],
        ];
    }
}
