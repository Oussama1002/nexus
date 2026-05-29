<?php

namespace App\Http\Requests\Api;

use App\Services\ShipmentOperationsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PatchShipmentStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(ShipmentOperationsService::STATUSES)],
            'note' => ['nullable', 'string'],
            'failure_reason' => ['nullable', 'string'],
            'return_reason' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'event_at' => ['nullable', 'date'],
        ];
    }
}
