<?php

namespace App\Http\Requests\Api;

use App\Support\ApiBrandContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCampaignRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $brandId = ApiBrandContext::resolveBrandId($this);

        return [
            'ad_account_id' => ['sometimes', 'nullable', 'integer', 'exists:ad_accounts,id'],
            'product_id' => ['nullable', 'integer', Rule::exists('products', 'id')->where(fn ($q) => $q->where('brand_id', $brandId))],
            'influencer_id' => ['nullable', 'integer', Rule::exists('influencers', 'id')->where(fn ($q) => $q->where('brand_id', $brandId))],
            'confirmatrice_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'name' => ['sometimes', 'string', 'max:255'],
            'source' => ['sometimes', Rule::in(['meta', 'tiktok', 'google', 'snap', 'linkedin', 'other'])],
            'marketing_objective' => ['nullable', Rule::in([
                'lead_gen', 'messages', 'conversions', 'traffic', 'engagement', 'awareness', 'sales',
            ])],
            'budget' => ['sometimes', 'numeric', 'min:0'],
            'daily_budget' => ['nullable', 'numeric', 'min:0'],
            'campaign_currency' => ['nullable', 'string', 'max:10'],
            'attribution_model' => ['nullable', 'string', 'max:64'],
            'spend' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['draft', 'active', 'paused', 'ended', 'cancelled'])],
            'objective' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'creatives_summary' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'landing_url' => ['nullable', 'string', 'max:2048'],
            'utm_source' => ['nullable', 'string', 'max:128'],
            'utm_campaign' => ['nullable', 'string', 'max:128'],
            'utm_medium' => ['nullable', 'string', 'max:128'],
            'pixel_id' => ['nullable', 'string', 'max:128'],
            'target_cac' => ['nullable', 'numeric', 'min:0'],
            'target_cpa' => ['nullable', 'numeric', 'min:0'],
            'target_roas' => ['nullable', 'numeric', 'min:0'],
            'target_leads' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
