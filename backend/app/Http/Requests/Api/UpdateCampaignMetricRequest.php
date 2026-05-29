<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCampaignMetricRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'metric_date' => ['sometimes', 'date'],
            'reach' => ['nullable', 'integer', 'min:0'],
            'messages' => ['nullable', 'integer', 'min:0'],
            'spend' => ['sometimes', 'numeric', 'min:0'],
            'impressions' => ['nullable', 'integer', 'min:0'],
            'clicks' => ['nullable', 'integer', 'min:0'],
            'leads' => ['nullable', 'integer', 'min:0'],
            'confirmed_orders' => ['nullable', 'integer', 'min:0'],
            'delivered_orders' => ['nullable', 'integer', 'min:0'],
            'revenue' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
