<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreChargeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'order_id' => ['nullable', 'integer', 'exists:orders,id'],
            'campaign_id' => ['nullable', 'integer', 'exists:campaigns,id'],
            'charge_date' => ['required', 'date'],
            'type' => ['required', Rule::in(['ads', 'salary', 'delivery', 'supplier', 'rent', 'tools', 'influencer', 'other'])],
            'amount' => ['required', 'numeric', 'gt:0'],
            'note' => ['nullable', 'string'],
        ];
    }
}
