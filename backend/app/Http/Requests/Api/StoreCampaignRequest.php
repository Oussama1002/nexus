<?php

namespace App\Http\Requests\Api;

use App\Support\ApiBrandContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCampaignRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $brandId = ApiBrandContext::resolveBrandId($this);

        return [
            'ad_account_id' => ['required', 'integer', 'exists:ad_accounts,id'],
            'product_id' => ['nullable', 'integer', Rule::exists('products', 'id')->where(fn ($q) => $q->where('brand_id', $brandId))],
            'influencer_id' => ['nullable', 'integer', Rule::exists('influencers', 'id')->where(fn ($q) => $q->where('brand_id', $brandId))],
            'confirmatrice_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'name' => ['required', 'string', 'max:255'],
            'source' => ['required', Rule::in(['meta', 'tiktok', 'google', 'snap', 'linkedin', 'other'])],
            'marketing_objective' => ['nullable', Rule::in([
                'lead_gen', 'messages', 'conversions', 'traffic', 'engagement', 'awareness', 'sales',
            ])],
            'budget' => ['required', 'numeric', 'min:0'],
            'daily_budget' => ['nullable', 'numeric', 'min:0'],
            'campaign_currency' => ['nullable', 'string', 'max:10'],
            'attribution_model' => ['nullable', 'string', 'max:64'],
            'spend' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['draft', 'active', 'paused', 'ended', 'cancelled'])],
            'objective' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'creatives_summary' => ['nullable', 'string'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
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

    /**
     * Noms français : sans ça l'erreur parle de « ad account id ».
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'ad_account_id' => 'compte publicitaire',
            'product_id' => 'produit lié',
            'influencer_id' => 'influenceur lié',
            'confirmatrice_user_id' => 'confirmatrice assignée',
            'name' => 'nom de la campagne',
            'source' => 'plateforme',
            'marketing_objective' => 'objectif marketing',
            'budget' => 'budget total',
            'daily_budget' => 'budget quotidien',
            'campaign_currency' => 'devise',
            'attribution_model' => 'modèle d’attribution',
            'start_date' => 'date de début',
            'end_date' => 'date de fin',
            'landing_url' => 'URL de la landing page',
            'utm_source' => 'UTM source',
            'utm_campaign' => 'UTM campaign',
            'utm_medium' => 'UTM medium',
            'pixel_id' => 'Pixel ID',
            'target_cpa' => 'CPA cible',
            'target_roas' => 'ROAS cible',
            'target_leads' => 'leads cibles',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'required' => 'Le champ « :attribute » est obligatoire.',
            'ad_account_id.exists' => 'Ce compte publicitaire n’existe pas : créez-le dans Comptes publicitaires.',
            'numeric' => 'Le champ « :attribute » doit être un nombre.',
            'date' => 'Le champ « :attribute » doit être une date valide.',
            'end_date.after_or_equal' => 'La date de fin ne peut pas précéder la date de début.',
            'in' => 'La valeur du champ « :attribute » n’est pas autorisée.',
            'max' => 'Le champ « :attribute » est trop long.',
        ];
    }
}
