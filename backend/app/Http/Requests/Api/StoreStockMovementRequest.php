<?php

namespace App\Http\Requests\Api;

use App\Services\StockService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStockMovementRequest extends FormRequest
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
            'product_id' => ['required', 'exists:products,id'],
            'movement_type' => ['required', Rule::in(StockService::MOVEMENT_TYPES)],
            'quantity' => ['required_unless:movement_type,adjustment', 'integer', 'min:1'],
            'signed_delta' => ['required_if:movement_type,adjustment', 'integer', 'not_in:0'],
            'reason' => ['nullable', 'string', 'max:255'],
            'reference_type' => ['nullable', 'string', 'max:100'],
            'reference_id' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
