<?php

namespace App\Support;

/**
 * Définitions des clés autorisées par groupe (validation serveur).
 * Les valeurs sensibles ne sont jamais exposées en clair ni journalisées en clair.
 */
class SystemSettingRegistry
{
    /** Aligné avec le masquage API / frontend */
    public const MASK_DISPLAY = '*************';

    /** @return list<string> */
    public static function groupIds(): array
    {
        return ['general', 'integrations', 'delivery', 'whatsapp', 'meta', 'finance', 'security'];
    }

    /**
     * @return array<string, array{sensitive: bool, description: string}>
     */
    public static function definitions(string $group): array
    {
        return match ($group) {
            'general' => self::generalDefinitions(),
            'integrations' => self::integrationsDefinitions(),
            'delivery' => self::deliveryDefinitions(),
            'whatsapp' => self::whatsappDefinitions(),
            'meta' => self::metaDefinitions(),
            'finance' => self::financeDefinitions(),
            'security' => self::securityDefinitions(),
            default => [],
        };
    }

    /**
     * @return array<string, array{sensitive: bool, description: string}>
     */
    private static function generalDefinitions(): array
    {
        return [
            'company_name' => ['sensitive' => false, 'description' => 'Nom de l’entreprise'],
            'company_logo_url' => ['sensitive' => false, 'description' => 'URL du logo'],
            'company_email' => ['sensitive' => false, 'description' => 'E-mail principal'],
            'company_phone' => ['sensitive' => false, 'description' => 'Téléphone principal'],
            'company_address' => ['sensitive' => false, 'description' => 'Adresse'],
            'company_city' => ['sensitive' => false, 'description' => 'Ville'],
            'company_ice' => ['sensitive' => false, 'description' => 'ICE'],
            'company_if' => ['sensitive' => false, 'description' => 'Identifiant fiscal (IF)'],
            'company_rc' => ['sensitive' => false, 'description' => 'RC'],
            'company_patente' => ['sensitive' => false, 'description' => 'Patente'],
            'company_website' => ['sensitive' => false, 'description' => 'Site web'],
            'system_timezone' => ['sensitive' => false, 'description' => 'Fuseau horaire (ex. Africa/Casablanca)'],
            'system_default_language' => ['sensitive' => false, 'description' => 'Langue par défaut (fr, ar, …)'],
            'system_currency' => ['sensitive' => false, 'description' => 'Devise (ex. MAD)'],
            'system_date_format' => ['sensitive' => false, 'description' => 'Format de date (ex. dd/MM/yyyy)'],
            'system_phone_format_ma' => ['sensitive' => false, 'description' => 'Format téléphone Maroc'],
            'brand_primary_color' => ['sensitive' => false, 'description' => 'Couleur principale (hex)'],
            'brand_crm_display_name' => ['sensitive' => false, 'description' => 'Nom CRM affiché'],
            'brand_favicon_url' => ['sensitive' => false, 'description' => 'URL favicon'],
            'workflow_default_lead_status' => ['sensitive' => false, 'description' => 'Statut lead par défaut'],
            'workflow_default_order_status' => ['sensitive' => false, 'description' => 'Statut commande par défaut'],
            'workflow_default_shipping_fee' => ['sensitive' => false, 'description' => 'Frais livraison par défaut'],
            'workflow_lead_sla_hours' => ['sensitive' => false, 'description' => 'Durée SLA lead (heures)'],
        ];
    }

    /**
     * @return array<string, array{sensitive: bool, description: string}>
     */
    private static function integrationsDefinitions(): array
    {
        return [
            'smtp_host' => ['sensitive' => false, 'description' => 'Hôte SMTP'],
            'smtp_port' => ['sensitive' => false, 'description' => 'Port SMTP'],
            'smtp_user' => ['sensitive' => false, 'description' => 'Utilisateur SMTP'],
            'smtp_password' => ['sensitive' => true, 'description' => 'Mot de passe SMTP'],
            'smtp_encryption' => ['sensitive' => false, 'description' => 'Chiffrement (tls, ssl, …)'],
            'smtp_sender_name' => ['sensitive' => false, 'description' => 'Nom expéditeur e-mail'],
            'sms_provider' => ['sensitive' => false, 'description' => 'Fournisseur SMS'],
            'sms_api_key' => ['sensitive' => true, 'description' => 'Clé API SMS'],
            'sms_sender' => ['sensitive' => false, 'description' => 'Expéditeur SMS'],
            'storage_driver' => ['sensitive' => false, 'description' => 'Stockage : local, s3, cloudinary'],
            'storage_bucket' => ['sensitive' => false, 'description' => 'Bucket / conteneur'],
            'storage_access_key' => ['sensitive' => true, 'description' => 'Clé d’accès stockage'],
            'storage_secret_key' => ['sensitive' => true, 'description' => 'Secret stockage'],
            'integration_webhook_url' => ['sensitive' => false, 'description' => 'URL webhook sortant'],
            'integration_webhook_secret' => ['sensitive' => true, 'description' => 'Secret webhook'],
        ];
    }

    /**
     * @return array<string, array{sensitive: bool, description: string}>
     */
    private static function deliveryDefinitions(): array
    {
        return [
            'delivery_default_company_id' => ['sensitive' => false, 'description' => 'Société de livraison par défaut (ID)'],
            'delivery_default_fee' => ['sensitive' => false, 'description' => 'Frais livraison par défaut'],
            'delivery_avg_days' => ['sensitive' => false, 'description' => 'Délai moyen de livraison (jours)'],
            'delivery_allow_open_package' => ['sensitive' => false, 'description' => 'Autoriser ouverture colis (oui/non)'],
            'delivery_insurance_enabled' => ['sensitive' => false, 'description' => 'Activer assurance'],
            'delivery_auto_tracking_number' => ['sensitive' => false, 'description' => 'Générer n° de suivi auto'],
            'delivery_auto_sync_tracking' => ['sensitive' => false, 'description' => 'Synchronisation suivi auto'],
            'carrier_sendit_api_url' => ['sensitive' => false, 'description' => 'Sendit — URL API'],
            'carrier_sendit_public_key' => ['sensitive' => true, 'description' => 'Sendit — clé publique'],
            'carrier_sendit_secret_key' => ['sensitive' => true, 'description' => 'Sendit — clé secrète'],
            'carrier_ameex_api_url' => ['sensitive' => false, 'description' => 'Ameex — URL API'],
            'carrier_ameex_api_key' => ['sensitive' => true, 'description' => 'Ameex — clé API'],
            'carrier_amana_api_url' => ['sensitive' => false, 'description' => 'Amana — URL API (legacy)'],
            'carrier_amana_api_key' => ['sensitive' => true, 'description' => 'Amana — clé API (legacy)'],
            'carrier_ozon_api_url' => ['sensitive' => false, 'description' => 'Ozon — URL API (legacy)'],
            'carrier_ozon_api_key' => ['sensitive' => true, 'description' => 'Ozon — clé API (legacy)'],
            'cod_reconciliation_delay_days' => ['sensitive' => false, 'description' => 'Délai réconciliation COD (jours)'],
            'cod_dispute_tolerance' => ['sensitive' => false, 'description' => 'Tolérance litige COD'],
        ];
    }

    /**
     * @return array<string, array{sensitive: bool, description: string}>
     */
    private static function whatsappDefinitions(): array
    {
        return [
            'wa_provider' => ['sensitive' => false, 'description' => 'Fournisseur WhatsApp'],
            'wa_api_base_url' => ['sensitive' => false, 'description' => 'URL de base API WhatsApp'],
            'wa_business_number' => ['sensitive' => false, 'description' => 'Numéro professionnel WhatsApp'],
            'wa_business_account_id' => ['sensitive' => false, 'description' => 'WhatsApp Business Account ID'],
            'wa_api_token' => ['sensitive' => true, 'description' => 'Jeton API WhatsApp'],
            'wa_phone_id' => ['sensitive' => false, 'description' => 'Phone ID'],
            'wa_webhook_verify_token' => ['sensitive' => true, 'description' => 'Jeton de vérification webhook'],
            'wa_webhook_display_url' => ['sensitive' => false, 'description' => 'URL webhook publique'],
            'wa_auto_assign_conversations' => ['sensitive' => false, 'description' => 'Assignation auto des conversations'],
            'wa_auto_create_lead' => ['sensitive' => false, 'description' => 'Création auto de lead'],
            'wa_default_welcome_message' => ['sensitive' => false, 'description' => 'Message d’accueil par défaut'],
            'wa_enable_auto_replies' => ['sensitive' => false, 'description' => 'Réponses automatiques'],
            'wa_tpl_order_confirmation' => ['sensitive' => false, 'description' => 'Modèle confirmation commande'],
            'wa_tpl_delivery' => ['sensitive' => false, 'description' => 'Modèle livraison'],
            'wa_tpl_relance' => ['sensitive' => false, 'description' => 'Modèle relance'],
            'wa_tpl_upsell' => ['sensitive' => false, 'description' => 'Modèle upsell'],
        ];
    }

    /**
     * @return array<string, array{sensitive: bool, description: string}>
     */
    private static function metaDefinitions(): array
    {
        return [
            'meta_app_id' => ['sensitive' => false, 'description' => 'Meta App ID'],
            'meta_app_secret' => ['sensitive' => true, 'description' => 'Meta App Secret'],
            'meta_access_token' => ['sensitive' => true, 'description' => 'Meta Access Token'],
            'meta_business_id' => ['sensitive' => false, 'description' => 'Meta Business ID'],
            'meta_attribution_window_days' => ['sensitive' => false, 'description' => 'Fenêtre d’attribution (jours)'],
            'meta_sync_frequency_minutes' => ['sensitive' => false, 'description' => 'Fréquence synchro (minutes)'],
            'meta_currency' => ['sensitive' => false, 'description' => 'Devise Ads'],
            'meta_enable_utm' => ['sensitive' => false, 'description' => 'Activer suivi UTM'],
            'meta_enable_campaign_attribution' => ['sensitive' => false, 'description' => 'Attribution campagne'],
            'meta_enable_roas' => ['sensitive' => false, 'description' => 'Calcul ROAS'],
            'meta_target_cac' => ['sensitive' => false, 'description' => 'Objectif CAC'],
            'meta_target_cpa' => ['sensitive' => false, 'description' => 'Objectif CPA'],
            'meta_target_roas' => ['sensitive' => false, 'description' => 'Objectif ROAS'],
        ];
    }

    /**
     * @return array<string, array{sensitive: bool, description: string}>
     */
    private static function financeDefinitions(): array
    {
        return [
            'finance_currency' => ['sensitive' => false, 'description' => 'Devise comptable'],
            'finance_tax_percent' => ['sensitive' => false, 'description' => 'TVA %'],
            'finance_invoice_format' => ['sensitive' => false, 'description' => 'Format facture'],
            'finance_invoice_prefix' => ['sensitive' => false, 'description' => 'Préfixe facture'],
            'finance_cod_delay_days' => ['sensitive' => false, 'description' => 'Délai COD (jours)'],
            'finance_default_payment_status' => ['sensitive' => false, 'description' => 'Statut paiement par défaut'],
            'finance_charge_categories' => ['sensitive' => false, 'description' => 'Catégories de charges (JSON ou liste)'],
            'finance_expense_validation' => ['sensitive' => false, 'description' => 'Validation des dépenses'],
            'finance_invoice_auto_numbering' => ['sensitive' => false, 'description' => 'Numérotation facture auto (oui/non)'],
            'finance_enable_accounting_export' => ['sensitive' => false, 'description' => 'Export comptable'],
            'finance_export_format' => ['sensitive' => false, 'description' => 'Format export (csv, excel, …)'],
        ];
    }

    /**
     * @return array<string, array{sensitive: bool, description: string}>
     */
    private static function securityDefinitions(): array
    {
        return [
            'security_enable_2fa' => ['sensitive' => false, 'description' => 'Activer 2FA'],
            'security_session_duration_minutes' => ['sensitive' => false, 'description' => 'Durée de session (minutes)'],
            'security_max_login_attempts' => ['sensitive' => false, 'description' => 'Tentatives de connexion max'],
            'security_password_min_length' => ['sensitive' => false, 'description' => 'Longueur minimale mot de passe'],
            'security_password_require_complexity' => ['sensitive' => false, 'description' => 'Complexité obligatoire'],
            'security_password_expiry_days' => ['sensitive' => false, 'description' => 'Expiration mot de passe (jours, 0=désactivé)'],
            'security_multiple_admins_allowed' => ['sensitive' => false, 'description' => 'Plusieurs administrateurs'],
            'security_audit_required' => ['sensitive' => false, 'description' => 'Audit obligatoire'],
            'security_audit_retention_days' => ['sensitive' => false, 'description' => 'Conserver journaux audit (jours)'],
            'security_session_retention_days' => ['sensitive' => false, 'description' => 'Conserver sessions (jours)'],
            'security_rate_limiting' => ['sensitive' => false, 'description' => 'Limite de débit API'],
            'security_ip_whitelist' => ['sensitive' => false, 'description' => 'Liste IP autorisées (CSV)'],
            'security_allowed_origins' => ['sensitive' => false, 'description' => 'Origines CORS autorisées'],
            'security_encrypt_sensitive_fields' => ['sensitive' => false, 'description' => 'Chiffrer champs sensibles'],
            'security_mask_api_secrets' => ['sensitive' => false, 'description' => 'Masquer secrets API en UI'],
        ];
    }
}
