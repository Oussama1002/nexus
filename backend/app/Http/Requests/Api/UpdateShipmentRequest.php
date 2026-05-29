<?php

namespace App\Http\Requests\Api;

use App\Services\ShipmentOperationsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateShipmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'delivery_company_id' => ['nullable', 'integer', 'exists:delivery_companies,id'],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'external_tracking_id' => ['nullable', 'string', 'max:190'],
            'cod_amount' => ['nullable', 'numeric', 'min:0'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'insurance_fee' => ['nullable', 'numeric', 'min:0'],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'recipient_phone' => ['nullable', 'string', 'max:30'],
            'recipient_city' => ['nullable', 'string', 'max:120'],
            'recipient_address' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'pickup_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'failure_reason' => ['nullable', 'string'],
            'return_reason' => ['nullable', 'string'],
            'payment_status' => ['nullable', Rule::in(ShipmentOperationsService::PAYMENT_STATUSES)],
            'carrier_label_url' => ['nullable', 'string', 'max:512'],
            'status' => ['nullable', Rule::in(ShipmentOperationsService::STATUSES)],
        ];
    }
}
