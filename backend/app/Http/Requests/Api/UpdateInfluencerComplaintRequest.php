<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateInfluencerComplaintRequest extends FormRequest
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
            'title' => ['sometimes', 'string', 'max:255'],
            'category' => ['sometimes', Rule::in(['delay', 'bad_content', 'contract', 'payment', 'quality', 'other'])],
            'description' => ['nullable', 'string'],
            'severity' => ['sometimes', Rule::in(['low', 'medium', 'high', 'critical'])],
            'status' => ['sometimes', Rule::in(['open', 'in_review', 'resolved', 'reopened', 'closed'])],
            'resolution_notes' => ['nullable', 'string'],
            'resolved_at' => ['nullable', 'date'],
        ];
    }
}
