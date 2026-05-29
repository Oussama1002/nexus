<?php

namespace App\Http\Requests\Api;

use App\Support\ApiBrandContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderRequest extends FormRequest
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
            'customer_id' => ['nullable', 'exists:customers,id'],
            'lead_id' => ['nullable', 'exists:leads,id'],
            'assigned_user_id' => ['nullable', 'exists:users,id'],
            'source' => ['nullable', 'string', 'max:100'],
            'payment_method' => ['nullable', Rule::in(['prepaid', 'cod', 'card', 'transfer'])],
            'payment_state' => ['nullable', Rule::in(['paid', 'unpaid', 'partial', 'refunded', 'cod_pending'])],
            'bank_transfer_declared_paid' => ['nullable', 'boolean'],
            'bank_transfer_reference' => ['nullable', 'string', 'max:120'],
            'bank_transfer_verification_status' => ['nullable', Rule::in(['not_required', 'pending', 'verified', 'failed'])],
            'bank_transfer_verification_note' => ['nullable', 'string', 'max:255'],
            'shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'shipping_address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'lines' => ['sometimes', 'array', 'min:1'],
            'lines.*.id' => ['sometimes', 'integer', 'exists:order_lines,id'],
            'lines.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'lines.*.product_name' => ['required_with:lines', 'string', 'max:255'],
            'lines.*.quantity' => ['required_with:lines', 'integer', 'min:1'],
            'lines.*.unit_price' => ['required_with:lines', 'numeric', 'min:0'],
        ];
    }
}
