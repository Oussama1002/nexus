<?php

namespace App\Http\Requests\Api;

use App\Services\ShipmentOperationsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreShipmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'order_id' => ['required', 'integer', 'exists:orders,id'],
            'delivery_company_id' => ['required', 'integer', 'exists:delivery_companies,id'],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'cod_amount' => ['nullable', 'numeric', 'min:0'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'insurance_fee' => ['nullable', 'numeric', 'min:0'],
            'recipient_name' => ['required', 'string', 'max:255'],
            'recipient_phone' => ['required', 'string', 'max:30'],
            'recipient_city' => ['required', 'string', 'max:120'],
            'recipient_address' => ['required', 'string'],
            'city' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'pickup_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(ShipmentOperationsService::STATUSES)],
            'payment_status' => ['nullable', Rule::in(ShipmentOperationsService::PAYMENT_STATUSES)],
        ];
    }
}
