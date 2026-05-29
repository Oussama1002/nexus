<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreClientContractRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'title' => ['required', 'string', 'max:255'],
            'contract_number' => ['nullable', 'string', 'max:80'],
            'storage_provider' => ['nullable', Rule::in(['google_drive', 'dropbox', 'onedrive', 'other'])],
            'external_url' => ['nullable', 'url', 'max:1000'],
            'status' => ['nullable', Rule::in(['draft', 'active', 'expired', 'terminated'])],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'signed_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
