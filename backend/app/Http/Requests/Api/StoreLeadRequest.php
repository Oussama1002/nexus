<?php

namespace App\Http\Requests\Api;

use App\Support\ApiBrandContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLeadRequest extends FormRequest
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
        $brandId = ApiBrandContext::resolveBrandId($this);

        return [
            'campaign_id' => ['nullable', 'integer', Rule::exists('campaigns', 'id')->where(fn ($q) => $q->where('brand_id', $brandId))],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'customer' => ['nullable', 'array'],
            'customer.full_name' => ['required_without:customer_id', 'string', 'max:255'],
            'customer.phone' => ['required_without:customer_id', 'string', 'max:30'],
            'customer.city' => ['required_without:customer_id', 'string', 'max:120'],
            'customer.address' => ['nullable', 'string'],
            'customer.gender' => ['nullable', 'string', 'max:30'],
            'customer.email' => ['nullable', 'email', 'max:255'],
            'assigned_user_id' => ['nullable', 'exists:users,id'],
            'source' => ['required', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['new', 'contacted', 'qualified', 'confirmed', 'lost', 'archived'])],
            'estimated_value' => ['nullable', 'numeric', 'min:0'],
            'product_interest' => ['nullable', 'string', 'max:255'],
            'interest_level' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
