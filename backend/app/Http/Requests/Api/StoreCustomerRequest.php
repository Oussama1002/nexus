<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCustomerRequest extends FormRequest
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
            'origin_lead_id' => ['nullable', 'integer', 'exists:leads,id'],
            'assigned_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'full_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'phone_secondary' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'city' => ['required', 'string', 'max:120'],
            'neighborhood' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string'],
            'gender' => ['nullable', 'string', 'max:30'],
            'birth_date' => ['nullable', 'date'],
            'client_source' => ['nullable', Rule::in(['whatsapp', 'ads', 'influencer', 'site', 'manual', 'referral'])],
            'lifecycle_status' => ['nullable', Rule::in(['new', 'active', 'loyal', 'inactive', 'blacklisted'])],
            'client_type' => ['nullable', Rule::in(['individual', 'reseller', 'vip'])],
            'interest_level' => ['nullable', Rule::in(['low', 'medium', 'high', 'hot'])],
            'delivery_city' => ['nullable', 'string', 'max:120'],
            'delivery_address' => ['nullable', 'string'],
            'delivery_landmark' => ['nullable', 'string', 'max:255'],
            'delivery_zone' => ['nullable', 'string', 'max:120'],
            'default_shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'preferred_products' => ['nullable', 'string'],
            'preferred_variant' => ['nullable', 'string', 'max:255'],
            'preferred_language' => ['nullable', Rule::in(['darija', 'fr', 'ar'])],
            'preferred_payment' => ['nullable', Rule::in(['cod', 'transfer', 'online'])],
            'internal_notes' => ['nullable', 'string'],
            'blacklist_reason' => ['nullable', 'string'],
            'risk_score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'blacklisted'])],
        ];
    }
}
