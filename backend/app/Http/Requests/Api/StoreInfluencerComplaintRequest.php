<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInfluencerComplaintRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'influencer_id' => ['required', 'integer', 'exists:influencers,id'],
            'influencer_collaboration_id' => ['nullable', 'integer', 'exists:influencer_collaborations,id'],
            'title' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(['delay', 'bad_content', 'contract', 'payment', 'quality', 'other'])],
            'description' => ['nullable', 'string'],
            'severity' => ['required', Rule::in(['low', 'medium', 'high', 'critical'])],
            'status' => ['nullable', Rule::in(['open', 'in_review', 'resolved', 'reopened', 'closed'])],
            'resolution_notes' => ['nullable', 'string'],
            'resolved_at' => ['nullable', 'date'],
        ];
    }
}
