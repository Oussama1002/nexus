<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreConversationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', 'exists:customers,id'],
            'lead_id' => ['nullable', 'exists:leads,id'],
            'assigned_user_id' => ['nullable', 'exists:users,id'],
            'channel' => ['nullable', Rule::in(['whatsapp', 'instagram', 'facebook', 'tiktok', 'other'])],
            'external_thread_id' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in([
                'open',
                'pending',
                'resolved',
                'closed',
                'en_cours_traitement',
                'pas_de_reponse',
                'vu_non_repondu',
                'confirme',
                'a_suivre',
                'livre',
            ])],
        ];
    }
}
