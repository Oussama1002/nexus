<?php

namespace App\Http\Requests\Api;

use App\Services\ShipmentOperationsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreShipmentEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'shipment_id' => ['required', 'integer', 'exists:shipments,id'],
            'event_type' => ['required', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(ShipmentOperationsService::STATUSES)],
            'note' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'raw_payload_json' => ['nullable', 'array'],
            'event_at' => ['nullable', 'date'],
        ];
    }
}
