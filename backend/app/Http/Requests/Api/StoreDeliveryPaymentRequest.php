<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDeliveryPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'delivery_company_id' => ['required', 'integer', 'exists:delivery_companies,id'],
            'label' => ['required', 'string', 'max:255'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date', 'after_or_equal:period_start'],
            'state' => ['nullable', Rule::in(['draft', 'received', 'reconciled', 'disputed'])],
            'payment_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'shipment_ids' => ['nullable', 'array'],
            'shipment_ids.*' => ['integer', 'exists:shipments,id'],
        ];
    }
}
