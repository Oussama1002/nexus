<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateInfluencerCollaborationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'influencer_id' => ['sometimes', 'integer', 'exists:influencers,id'],
            'campaign_id' => ['nullable', 'integer', 'exists:campaigns,id'],
            'owner_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'title' => ['sometimes', 'string', 'max:255'],
            'collaboration_type' => ['sometimes', Rule::in(['story', 'reel', 'post', 'live', 'package', 'ambassador'])],
            'deliverables' => ['nullable', 'string'],
            'contract_url' => ['nullable', 'string', 'max:500'],
            'agreed_amount' => ['sometimes', 'numeric', 'min:0'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'status' => ['sometimes', Rule::in(['draft', 'negotiation', 'approved', 'active', 'completed', 'cancelled', 'disputed'])],
        ];
    }
}
