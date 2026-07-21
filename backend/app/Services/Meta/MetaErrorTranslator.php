<?php

namespace App\Services\Meta;

/**
 * Traduit les messages d'erreur bruts (anglais) renvoyés par l'API Meta / Graph
 * (Ads + WhatsApp Cloud) en messages clairs en français pour l'utilisateur.
 */
class MetaErrorTranslator
{
    /**
     * @param  string  $raw  Message brut renvoyé par Meta.
     * @param  int|null  $code  Code d'erreur Graph (ex. 190 = token invalide).
     */
    public static function toFrench(string $raw, ?int $code = null): string
    {
        $normalized = strtolower(trim($raw));

        if ($normalized === '') {
            return 'Erreur Meta inconnue.';
        }

        // Session / jeton expiré ou révoqué (code 190 et variantes).
        if (
            $code === 190
            || str_contains($normalized, 'session is invalid')
            || str_contains($normalized, 'session has been invalidated')
            || str_contains($normalized, 'the user logged out')
            || str_contains($normalized, 'user has not authorized')
            || str_contains($normalized, 'error validating access token')
            || str_contains($normalized, 'access token could not be decrypted')
        ) {
            return 'Jeton d’accès Meta invalide ou expiré (l’utilisateur s’est déconnecté). Reconnectez le compte dans Paramètres → Meta (« Connecter avec Facebook ») ou renseignez un nouveau jeton.';
        }

        // Jeton manquant.
        if (str_contains($normalized, 'access token') && str_contains($normalized, 'required')) {
            return 'Jeton d’accès Meta manquant. Configurez-le dans Paramètres → Meta.';
        }

        // Permissions insuffisantes.
        if (
            $code === 200
            || $code === 10
            || str_contains($normalized, 'permission')
            || str_contains($normalized, 'do not have sufficient')
            || str_contains($normalized, 'not have permission')
        ) {
            return 'Permissions Meta insuffisantes pour cette action. Vérifiez les autorisations de l’application et l’accès au Business Manager.';
        }

        // Limite de débit atteinte.
        if (
            $code === 4
            || $code === 17
            || $code === 32
            || $code === 613
            || str_contains($normalized, 'rate limit')
            || str_contains($normalized, 'too many calls')
            || str_contains($normalized, 'request limit reached')
        ) {
            return 'Limite d’appels Meta atteinte. Réessayez dans quelques minutes.';
        }

        // Objet introuvable / identifiant invalide.
        if (
            $code === 803
            || str_contains($normalized, 'does not exist')
            || str_contains($normalized, 'cannot be loaded due to missing permission')
            || str_contains($normalized, 'unknown path components')
            || str_contains($normalized, 'nonexisting field')
        ) {
            return 'Ressource Meta introuvable ou identifiant invalide (Business ID / WABA / compte publicitaire). Vérifiez la configuration.';
        }

        // Application mal configurée / clé secrète invalide.
        if (
            $code === 1
            || str_contains($normalized, 'invalid appsecret')
            || str_contains($normalized, 'invalid application')
            || str_contains($normalized, 'invalid client')
        ) {
            return 'Configuration de l’application Meta invalide (App ID / App Secret). Vérifiez vos identifiants dans Paramètres → Meta.';
        }

        // Numéro WhatsApp non enregistré sur Cloud API (#133010).
        if (
            $code === 133010
            || str_contains($normalized, 'account not registered')
            || str_contains($normalized, 'not registered')
        ) {
            return 'Ce numéro WhatsApp n’est pas encore enregistré sur l’API Cloud. Dans Meta → WhatsApp → Production setup, ouvrez le numéro, terminez « Register your WhatsApp phone number » (code PIN SMS), puis réessayez.';
        }

        // Fenêtre 24h / template requis.
        if (
            $code === 131047
            || str_contains($normalized, 're-engagement')
            || str_contains($normalized, 'outside of allowed window')
            || str_contains($normalized, 'message undeliverable')
        ) {
            return 'Impossible d’envoyer un message libre : le client n’a pas écrit dans les dernières 24 h. Utilisez un modèle WhatsApp approuvé, ou attendez qu’il vous écrive d’abord.';
        }

        // Repli : préfixe français conservant le détail Meta.
        return 'Erreur Meta : '.$raw;
    }
}
