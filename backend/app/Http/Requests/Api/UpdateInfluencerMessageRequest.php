<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateInfluencerMessageRequest extends FormRequest
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
            'sender_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'direction' => ['sometimes', Rule::in(['inbound', 'outbound'])],
            'channel' => ['sometimes', Rule::in(['whatsapp', 'instagram', 'email', 'phone', 'other'])],
            'message' => ['sometimes', 'string'],
            'message_at' => ['nullable', 'date'],
        ];
    }
}
