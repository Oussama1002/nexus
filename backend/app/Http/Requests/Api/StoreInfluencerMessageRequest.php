<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInfluencerMessageRequest extends FormRequest
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
            'sender_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'direction' => ['required', Rule::in(['inbound', 'outbound'])],
            'channel' => ['required', Rule::in(['whatsapp', 'instagram', 'email', 'phone', 'other'])],
            'message' => ['required', 'string'],
            'message_at' => ['nullable', 'date'],
        ];
    }
}
