<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'supplier_id' => ['sometimes', 'integer', 'exists:suppliers,id'],
            'responsible_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'reference' => ['sometimes', 'string', 'max:64'],
            'status' => ['nullable', Rule::in(['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled', 'returned'])],
            'payment_status' => ['nullable', Rule::in(['unpaid', 'partial', 'paid', 'refunded', 'cancelled'])],
            'currency' => ['nullable', 'string', 'max:8'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'tax' => ['nullable', 'numeric', 'min:0'],
            'shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:64'],
            'payment_due_date' => ['nullable', 'date'],
            'shipping_mode' => ['nullable', 'string', 'max:64'],
            'carrier_name' => ['nullable', 'string', 'max:255'],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'warehouse_destination' => ['nullable', 'string', 'max:255'],
            'supplier_conditions' => ['nullable', 'string'],
            'internal_notes' => ['nullable', 'string'],
            'attachments_json' => ['nullable', 'array'],
            'supplier_invoice_ref' => ['nullable', 'string', 'max:255'],
            'delivery_note_ref' => ['nullable', 'string', 'max:255'],
            'ordered_at' => ['sometimes', 'date'],
            'expected_delivery_date' => ['nullable', 'date'],
            'lines' => ['sometimes', 'array', 'min:1'],
            'lines.*.product_id' => ['required_with:lines', 'integer', 'exists:products,id'],
            'lines.*.quantity_ordered' => ['required_with:lines', 'integer', 'min:1'],
            'lines.*.unit_price' => ['required_with:lines', 'numeric', 'min:0'],
            'lines.*.line_discount' => ['nullable', 'numeric', 'min:0'],
            'lines.*.line_tax' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
