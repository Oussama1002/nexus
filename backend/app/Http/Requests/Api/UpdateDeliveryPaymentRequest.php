<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDeliveryPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'label' => ['sometimes', 'string', 'max:255'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date', 'after_or_equal:period_start'],
            'state' => ['nullable', Rule::in(['draft', 'received', 'reconciled', 'disputed'])],
            'payment_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string', Rule::requiredIf(fn () => $this->input('state') === 'disputed')],
        ];
    }
}
