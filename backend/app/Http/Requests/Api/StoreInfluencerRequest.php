<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInfluencerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'full_name' => ['required', 'string', 'max:255'],
            'username' => ['nullable', 'string', 'max:255'],
            'platform' => ['nullable', 'string', 'max:100'],
            'niche' => ['nullable', 'string', 'max:255'],
            'audience_size' => ['nullable', 'integer', 'min:0'],
            'engagement_rate' => ['nullable', 'numeric'],
            'pricing_json' => ['nullable', 'array'],
            'contact_phone' => ['nullable', 'string', 'max:30'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'status' => ['nullable', Rule::in(['new', 'qualified', 'negotiation', 'active', 'blacklisted', 'inactive'])],
        ];
    }
}
