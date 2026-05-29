<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateClientInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'customer_id' => ['sometimes', 'integer', 'exists:customers,id'],
            'contract_id' => ['nullable', 'integer', 'exists:client_contracts,id'],
            'billing_period_start' => ['sometimes', 'date'],
            'billing_period_end' => ['sometimes', 'date', 'after_or_equal:billing_period_start'],
            'issue_date' => ['sometimes', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'subtotal' => ['sometimes', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', Rule::in(['draft', 'approved', 'sent', 'paid', 'cancelled'])],
            'recipient_email' => ['nullable', 'email:rfc,dns', 'max:255'],
            'notes' => ['nullable', 'string'],
            'meta' => ['nullable', 'array'],
        ];
    }
}
