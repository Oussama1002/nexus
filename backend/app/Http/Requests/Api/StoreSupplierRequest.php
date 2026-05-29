<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $types = ['product', 'packaging', 'raw_material', 'service', 'delivery', 'other'];

        return [
            'name' => ['required', 'string', 'max:255'],
            'supplier_code' => ['nullable', 'string', 'max:64'],
            'supplier_type' => ['required', Rule::in($types)],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:40'],
            'phone_secondary' => ['nullable', 'string', 'max:40'],
            'whatsapp' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => ['nullable', 'string', 'max:120'],
            'category' => ['nullable', 'string', 'max:100'],
            'products_supplied' => ['nullable', 'string'],
            'avg_lead_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:8'],
            'payment_terms' => ['nullable', 'string'],
            'preferred_payment_mode' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'blacklisted'])],
            'note' => ['nullable', 'string'],
            'quality_score' => ['nullable', 'numeric', 'min:0', 'max:10'],
            'frequent_delays' => ['nullable', 'boolean'],
            'complaints_notes' => ['nullable', 'string'],
            'ice' => ['nullable', 'string', 'max:80'],
            'if_number' => ['nullable', 'string', 'max:80'],
            'rc_number' => ['nullable', 'string', 'max:80'],
            'patente' => ['nullable', 'string', 'max:120'],
            'rib_iban' => ['nullable', 'string'],
            'contract_reference' => ['nullable', 'string', 'max:255'],
            'price_list_reference' => ['nullable', 'string', 'max:255'],
        ];
    }
}
