<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StorePurchaseOrderLineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'purchase_order_id' => ['required', 'integer', 'exists:purchase_orders,id'],
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity_ordered' => ['required', 'integer', 'min:1'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'line_discount' => ['nullable', 'numeric', 'min:0'],
            'line_tax' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
