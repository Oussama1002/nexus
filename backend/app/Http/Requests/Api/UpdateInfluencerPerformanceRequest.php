<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateInfluencerPerformanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'influencer_id' => ['sometimes', 'integer', 'exists:influencers,id'],
            'influencer_collaboration_id' => ['nullable', 'integer', 'exists:influencer_collaborations,id'],
            'campaign_id' => ['nullable', 'integer', 'exists:campaigns,id'],
            'metric_date' => ['sometimes', 'date'],
            'action_type' => ['sometimes', 'string', 'max:50'],
            'planned_actions' => ['nullable', 'integer', 'min:1'],
            'completed_actions' => ['nullable', 'integer', 'min:0'],
            'manager_comment' => ['nullable', 'string'],
            'views' => ['nullable', 'integer', 'min:0'],
            'reach' => ['nullable', 'integer', 'min:0'],
            'impressions' => ['nullable', 'integer', 'min:0'],
            'likes' => ['nullable', 'integer', 'min:0'],
            'comments' => ['nullable', 'integer', 'min:0'],
            'shares' => ['nullable', 'integer', 'min:0'],
            'saves' => ['nullable', 'integer', 'min:0'],
            'clicks' => ['nullable', 'integer', 'min:0'],
            'leads' => ['nullable', 'integer', 'min:0'],
            'orders' => ['nullable', 'integer', 'min:0'],
            'revenue' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
