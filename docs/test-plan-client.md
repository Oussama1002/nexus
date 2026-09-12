# Brandna CRM — Guide de test client

Ce document est votre feuille de route pour tester Brandna CRM. Suivez-le dans l'ordre : chaque étape prépare la suivante. Comptez **~2 h pour le test complet** ou **~30 min pour le test rapide** (cases marquées ⚡).

Chaque test précise :
- **Où** : le chemin dans l'interface
- **Faites** : les actions à effectuer
- **Attendu** : ce que vous devez observer
- **Si ça échoue** : les causes possibles

---

## Avant de commencer

### 0.1 ⚡ Ouvrir le CRM

- **Où** : https://dtcgalaxy.ma/login
- **Faites** : Connectez-vous avec votre compte administrateur.
- **Attendu** : Redirection vers le tableau de bord. Un logo Brandna en haut à gauche, une barre latérale à gauche, une barre supérieure avec sélecteur de marque, cloche 🔔 et avatar.
- **Si ça échoue** : Vérifier que le certificat SSL est valide et que le backend répond (`curl https://dtcgalaxy.ma/api/health`).

### 0.2 ⚡ Vérifier les rôles disponibles

- **Où** : Administration → Rôles & permissions
- **Attendu** : Une liste de rôles (Admin, Manager OPS, SMM, Community Manager, Media Buyer, Confirmatrice, Call Center Manager, etc.). Chaque rôle a un « Écran d'accueil » configurable.

### 0.3 Créer un compte pour chaque rôle testé

- **Où** : Administration → Utilisateurs → Nouvel utilisateur
- **Faites** : Créez au minimum 3 utilisateurs (Community Manager, Confirmatrice, SMM) en plus de l'admin. Assignez chacun à une marque.
- **Attendu** : Les nouveaux comptes apparaissent dans la liste. Le badge de leur rôle est affiché.

---

## 1. Administration & configuration

### 1.1 ⚡ Sélecteur de marque

- **Où** : Barre supérieure → menu déroulant en haut
- **Faites** : Changez de marque.
- **Attendu** : Le tableau de bord se recharge avec les données de la nouvelle marque. Les modules RH, Brandna Academy et Administration ne sont **PAS** filtrés (par design — spec §7.4).

### 1.2 Écran d'accueil par rôle

- **Où** : Administration → Rôles & permissions → sélectionner un rôle → dropdown « Écran d'accueil »
- **Faites** : Pour `community_manager`, choisissez « Publication & modération ». Sauvez.
- **Attendu** : Un utilisateur avec ce rôle atterrit sur cette page après connexion (au lieu du tableau de bord).

### 1.3 Configurer les intégrations WhatsApp

- **Où** : Administration → Intégrations → onglet WhatsApp
- **Faites** : Renseigner `wa_business_account_id` + `wa_api_token`.
- **Attendu** : Après sauvegarde, le bouton **Sync numéros WhatsApp** dans la même page liste vos numéros connectés.
- **Si ça échoue** : Voir `docs/working-method-audit.md` ou l'erreur affichée (souvent un token expiré côté Meta).

### 1.4 Configurer les intégrations Meta (SMM)

- **Où** : Administration → Intégrations → Meta
- **Faites** : Renseigner `meta_app_id`, `meta_business_id`, `meta_access_token` (jeton long-vie).
- **Attendu** : Voir la note complète dans « Meta API tokens for SMM » — le sync tourne automatiquement toutes les 30 min via cron.

---

## 2. Call Center — flux complet commande

### 2.1 ⚡ Créer un lead

- **Où** : Call Center → Leads → Nouveau lead
- **Faites** : Remplir nom, téléphone, source. Sauver.
- **Attendu** : Le lead apparaît dans la liste avec statut « Nouveau ».

### 2.2 ⚡ Convertir en commande

- **Où** : Lead → bouton « Créer commande »
- **Faites** : Ajouter un produit, une quantité, une adresse. Confirmer.
- **Attendu** : Une commande est créée. Le lead passe à « Converti ». La commande apparaît dans Call Center → Commandes avec statut « À confirmer ».

### 2.3 Espace Confirmatrice

- **Où** : Se connecter avec un compte `confirmatrice` → landing = espace confirmatrice
- **Faites** : Ouvrir la commande créée, cliquer « Confirmer ».
- **Attendu** : Statut passe à « Confirmée ». La commande est prête pour expédition.

### 2.4 ⚡ Créer une réclamation

- **Où** : Call Center → Réclamations → Nouvelle
- **Faites** : Sélectionner un client, une catégorie, une priorité (P1/P2/P3), une description, joindre au moins un fichier (spec §13 rule 2). Sauver.
- **Attendu** : Réclamation créée. Assignée automatiquement au Manager Call Center de la marque. Notifie le CM (le titulaire reçoit un message dans son inbox).
- **Si ça échoue** : Pièce jointe manquante → refus (422). C'est le comportement attendu.

---

## 3. Logistique

### 3.1 ⚡ Tableau de bord livraison

- **Où** : Logistique → Livraison KPI
- **Faites** : Régler la période « Du 01/09/2026, Au 30/09/2026 ». Sélectionner un transporteur (Ameex).
- **Attendu** : 12 tuiles KPI (Total, En attente, En transit, Livrées, Retours, Échecs, **Annulées**, Taux livraison, Taux retour, **Taux échec**, CA, COD).
- **Vérification** : Total = En attente + En transit + Livrées + Retours + Échecs + Annulées. Taux livraison = Livrées / (Livrées + Retours + Échecs).

### 3.2 Synchroniser Ameex

- **Où** : même écran → bouton « Sync Ameex »
- **Faites** : Cliquer, attendre.
- **Attendu** : Toast « Ameex synchronisé : X colis traités ». Rafraîchir. Les KPI reflètent les nouveaux colis.
- **Si ça échoue** : Voir Bugs & incidents — un `Auto` bug sera créé si le token Ameex est mauvais.

### 3.3 Traiter un échec de livraison

- **Où** : Logistique → Échecs de livraison
- **Faites** : Ouvrir un colis en échec, changer son statut, ajouter un commentaire.
- **Attendu** : Statut mis à jour, journal d'audit alimenté.

---

## 4. Marketing — Réseaux sociaux (SMM)

### 4.1 Créer une stratégie trimestrielle

- **Où** : Se connecter en `manager_operationnel` → Réseaux sociaux → Stratégie & contenu → onglet « Stratégie » → Nouvelle stratégie
- **Faites** : Remplir tous les champs. **Ajouter au moins un contributeur consulté** (règle §8 W1).
- **Attendu** : Stratégie créée en brouillon.

### 4.2 Soumettre la stratégie

- **Faites** : Cliquer « Soumettre » sur la stratégie.
- **Attendu** : Si aucun contributeur consulté → refus (422 « Aucune contribution enregistrée »). Sinon → statut « Soumise », la Direction reçoit une notification.
- **Si ça échoue** : Contributeur manquant → c'est le comportement voulu.

### 4.3 Valider la stratégie (Direction)

- **Où** : Se connecter en `admin` → même écran → onglet Stratégie
- **Faites** : Ouvrir la stratégie soumise, cliquer « Valider ».
- **Attendu** : Statut « Validée ». SMM + Media Buyer + Content Manager + Community Manager reçoivent la notification.
- **Vérification règle §V rule 4** : Le Manager OPS qui a soumis ne peut PAS valider (bouton grisé ou 422).

### 4.4 Créer un plan mensuel

- **Où** : `smm` → SMM workspace → onglet « Plan mensuel » → Nouveau
- **Faites** : Rattacher à la stratégie validée. Renseigner volumétrie.
- **Attendu** : Plan créé. Si la stratégie n'est pas validée, la création est bloquée (§8 W1 règle 3).

### 4.5 Créer un contenu

- **Où** : Contenus → Nouveau contenu
- **Faites** : Remplir titre, plateforme, format, pilier, finalité, date de publication.
- **Attendu** : Contenu créé, statut « À briefer ». Un `file_identifier` auto-généré au format `AAAAMMJJ_Plateforme_TypeContenu_TitreCourt_Statut`.

### 4.6 Marquer un contenu sensible

- **Faites** : Cocher « Contenu sensible » → sélectionner un motif.
- **Attendu** : Passage au statut « À valider Direction » lors de la révision.
- **Vérification §3.5 rule #4** : Un SMM ne peut PAS décocher « sensible » sur un contenu déjà marqué. Seule la Direction peut.

### 4.7 Transmettre au CM

- **Faites** : Sur un contenu au statut « Validé », remplir la fiche de publication (légende, hashtags, CTA). Cliquer « Transmettre au CM ».
- **Attendu** : Statut « Transmis au CM ». Le CM reçoit une notification. Le contenu apparaît dans la file du CM.
- **Si ça échoue** : Fiche incomplète → refus 422 (spec §6.6).

### 4.8 Vérifier le badge « En retard »

- **Où** : Contenus (onglet)
- **Attendu** : Un contenu dont `scheduled_publish_at` est dépassé et statut ≠ Publié affiche un badge rouge « En retard ». Calculé côté frontend, pas stocké (§7.3).

---

## 5. Community Manager

### 5.1 ⚡ Ma journée

- **Où** : Se connecter en `community_manager` → landing = Publication & modération → onglet « Ma journée »
- **Attendu** : Checklist du jour affichée. Publications assignées listées. Compteurs sur les onglets.

### 5.2 Cocher une tâche

- **Faites** : Cocher une ligne « À briefer ».
- **Attendu** : Ligne marquée « Fait ». `delay_minutes` calculé si un créneau était fixé. Journal d'audit alimenté.

### 5.3 Marquer un contenu publié

- **Où** : Onglet Publications
- **Faites** : Sur un contenu au statut « Transmis au CM », cliquer « Publier », coller le lien.
- **Attendu** : Statut passe à « Publié ». Le champ `published_url` est obligatoire (§13 rule 4).
- **Si ça échoue** : Sans lien → refus 422.

### 5.4 Historique des journées (E2)

- **Où** : Onglet « Historique »
- **Faites** : Régler date_from/date_to.
- **Attendu** : Liste des journées passées, taux de complétion, indicateur « Auto (minuit) » si clôturée automatiquement. **Lecture seule** — pas de modification possible.

### 5.5 Ressources CM (E8)

- **Où** : Bouton « Ressources CM » dans l'en-tête du module
- **Attendu** : Redirige vers Brandna Academy filtrée sur `department=community_management`.

### 5.6 Créer un relevé influenceur

- **Où** : Onglet « Suivi influenceurs » → Nouveau relevé
- **Faites** : Sélectionner un influenceur, plateforme, type. Ajouter un contenu.
- **Attendu** : Relevé créé. Le champ « archive_url » est **obligatoire** si `archived = true` (§13 rule 4).
- **Test Live** : Sélectionner type = « Live ». Les 3 champs Live (durée, cm_assisted_live, live_recording_archived) deviennent obligatoires.

### 5.7 Journal de modération

- **Où** : Onglet Modération → Nouvelle action
- **Faites** : Sélectionner une action = « Commentaire négatif traité ». **Ne pas** joindre de capture d'écran. Envoyer.
- **Attendu** : Refus 422 « Capture obligatoire » (§13 rule 3).

---

## 6. AM — Pilotage de marque

### 6.1 Ouvrir une feuille de route

- **Où** : `manager_operationnel` → Pilotage de marque → onglet « Feuille de route » → Ouvrir
- **Faites** : Sélectionner le template par défaut, assigner un Account Manager.
- **Attendu** : Feuille créée. 8 chantiers (SOP-01..08) + 9 portes (G0..G8) apparaissent automatiquement.

### 6.2 Demander G0

- **Où** : Onglet « Portes G0–G8 » → cliquer G0 → « Détails »
- **Faites** : Cliquer « Demander le franchissement » sans avoir attesté les critères.
- **Attendu** : Refus « Critères non satisfaits » (liste des critères manquants).

### 6.3 Attester les critères G0

- **Faites** : Modifier chaque critère en mode « attestation », cocher « Satisfait », signer.
- **Attendu** : Une fois tous les critères mandatory à « Satisfait », la demande de transit passe. G0 devient « Demandée ».

### 6.4 Valider G0 (Direction)

- **Où** : `admin` → même écran → G0
- **Faites** : Cliquer « Valider ». G0 étant une porte Direction (§25 answer #3), le Manager OPS n'a pas le droit.
- **Attendu** : G0 passe à « Franchie ». `current_gate_code` sur la roadmap est mis à jour.

### 6.5 Verrouillage G5 vs G7 (spec §6)

- **Faites** : Essayer de demander G5 avant que G7 ne soit franchie.
- **Attendu** : Refus « G5 (scaling) verrouillée : G7 (conversion) doit être franchie au préalable ».

### 6.6 Lock cross-module (Media Buying → G3)

- **Faites** : Sans avoir franchi G3, aller dans Media Buying → Nouvelle campagne → soumettre.
- **Attendu** : Refus 423 Locked « la porte G3 n'est pas franchie ». Une fois G3 franchie, la création est autorisée.

### 6.7 Dérogation

- **Où** : Onglet « Dérogations » → Décider une dérogation demandée
- **Faites** : Accorder avec une validité de 30 jours.
- **Attendu** : Dérogation active. La porte passe à « franchie_par_derogation ». L'expiration est journalisée. Refuse si `validity_days > 30` (§25 answer #4).

### 6.8 Configuration AM (E16)

- **Où** : Pilotage de marque → Config Pilotage
- **Faites** : Modifier un template de chantier, un rule de score de santé, un template de rapport.
- **Attendu** : Les listes affichent des étiquettes françaises (pas de JSON brut). Les modifications sont audit-loggées.

---

## 7. Communications internes

### 7.1 ⚡ Envoyer un DM

- **Où** : Sidebar → Équipe & RH → Communications internes
- **Faites** : Cliquer « Nouvelle conversation » → « Avec un utilisateur » → sélectionner un contact → écrire « Test DM » → envoyer.
- **Attendu** : Message apparaît dans la conversation. Timestamps corrects.

### 7.2 ⚡ Créer un groupe

- **Faites** : « Nouvelle conversation » → « Nouveau groupe » → titre « Test équipe » → sélectionner 2-3 membres → Créer.
- **Attendu** : Groupe créé. Vous êtes automatiquement membre. Il apparaît dans « Groupes » à gauche.

### 7.3 ⚡ Envoyer une image

- **Faites** : Dans une conversation, cliquer le trombone 📎, sélectionner une image (JPG/PNG < 15 Mo) → envoyer.
- **Attendu** : Image apparaît en miniature dans la bulle, cliquable pour l'agrandir. Le destinataire voit la même image.
- **Si ça échoue** : Erreur 500 → migration `add_attachments_to_internal_messages` non appliquée. Voir la commande de déploiement.

### 7.4 Envoyer un fichier PDF

- **Faites** : Attacher un PDF, envoyer.
- **Attendu** : Bulle avec icône fichier + nom + taille + flèche de téléchargement. Cliquer téléchargement fonctionne.

### 7.5 Indicateur de saisie

- **Faites** : Ouvrir la conversation avec un autre utilisateur (session B dans une autre fenêtre). Dans la session B, commencer à taper.
- **Attendu** : Dans la session A, sous les messages : « [Nom de B] est en train d'écrire… » apparaît en italique. Disparaît après 6 secondes d'inactivité.

### 7.6 Notifications push

- **Où** : Sur n'importe quel écran autre que Communications internes
- **Faites** : Session B envoie un DM à session A.
- **Attendu** : Session A voit :
  - Le badge sur l'icône 💬 en haut incrémente (+1)
  - Une notification navigateur (OS-level) « Nouveau message interne »
  - **Prérequis** : autorisation notifications accordée (dans le navigateur)

---

## 8. Notifications (module dédié)

### 8.1 Ouvrir le module

- **Où** : Sidebar → PILOTAGE → Notifications
- **Attendu** : 4 tuiles en haut (Critiques, Alertes, Infos, Succès). Liste des notifications en dessous.

### 8.2 Filtrer par sévérité

- **Faites** : Cliquer sur la tuile « Critiques ».
- **Attendu** : Seules les notifications critiques restent. Un lien « ← Voir toutes » apparaît.

### 8.3 Ouvrir une notification liée

- **Faites** : Cliquer sur une notification qui a un lien.
- **Attendu** : Navigation vers l'objet (ex : un contenu, une réclamation, une porte).

---

## 9. Bugs & incidents (auto-capture)

### 9.1 Signaler manuellement

- **Où** : Administration → Bugs & incidents → Signaler un bug
- **Faites** : Sélectionner « Autre » dans Type d'incident.
- **Attendu** : Un champ « Préciser le type » apparaît. Le champ est obligatoire si « Autre » est sélectionné.
- **Faites** : Remplir. Envoyer sans marque active.
- **Attendu** : Bug créé (pas d'erreur « brand required »).

### 9.2 Détection auto backend

- **Faites** : Déclencher une erreur serveur. Ex : dans la console navigateur, exécuter :
  ```js
  fetch('/api/nonexistent-endpoint-hopefully-500ing', { headers: { Authorization: 'Bearer ' + localStorage.getItem('nexus_token') } })
  ```
- **Attendu** : Refresh Bugs & incidents. Une nouvelle ligne avec le badge violet « Auto », reporter = « Système ». Si vous refaites la même erreur, un compteur `×2` apparaît (pas de nouvelle ligne — déduplication par fingerprint).

### 9.3 Détection auto frontend

- **Faites** : Console navigateur → `throw new Error('test auto-capture');`
- **Attendu** : Après ~1 s, une nouvelle ligne dans Bugs & incidents avec le message d'erreur.

---

## 10. WhatsApp (interne)

### 10.1 ⚡ Répondre à un client (fenêtre 24 h ouverte)

- **Où** : Conversations → sélectionner un thread où le client a écrit dans les dernières 24 h
- **Faites** : Écrire un message texte, envoyer.
- **Attendu** : Bulle bleue à droite avec statut ⓘ « sent » puis « delivered » (double coche grise) puis « read » (double coche colorée) quand le client ouvre.

### 10.2 Client hors fenêtre 24 h — Échec attendu

- **Faites** : Envoyer un texte libre à un client dont le dernier message est > 24 h.
- **Attendu** : Bulle avec badge rouge « Échec ⓘ ».
- **Faites** : Cliquer « Échec ⓘ ».
- **Attendu** : Alert box avec la cause exacte de Meta (ex « Re-engagement message »).

### 10.3 Envoyer un modèle approuvé

- **Prérequis** : Au moins un template Meta au statut APPROVED (voir sec. 0.3 du guide client `docs/whatsapp-templates-onboarding.md`).
- **Où** : Même conversation → bouton bleu 💬 à droite du trombone
- **Faites** : Cliquer, sélectionner un template, remplir les variables, envoyer.
- **Attendu** : Le message part, apparaît dans le thread. Le client reçoit le message même hors fenêtre 24 h. Sa réponse rouvre la fenêtre 24 h.

---

## 11. Projets collaboratifs

### 11.1 Créer un projet

- **Où** : Équipe & RH → Projets collaboratifs → Nouveau projet
- **Faites** : Titre, description, membres. Aucune marque sélectionnée (workspace partagé).
- **Attendu** : Projet créé. Pas d'erreur « brand required ».

### 11.2 Créer une tâche

- **Faites** : Ouvrir le projet → onglet Kanban → ajouter une carte dans « À faire ».
- **Attendu** : Tâche créée. Pas d'erreur brand.

### 11.3 Uploader un document

- **Faites** : Onglet Documents → uploader un PDF.
- **Attendu** : Document listé. Téléchargement fonctionne.

---

## 12. Score final & rapport de test

À l'issue du test, cochez pour chaque module :

| Module | Test rapide (⚡) OK | Test complet OK | Notes / bugs |
|---|---|---|---|
| Login / setup | ☐ | ☐ | |
| Sélecteur de marque | ☐ | ☐ | |
| Call Center | ☐ | ☐ | |
| Logistique / Ameex | ☐ | ☐ | |
| Marketing (SMM) | — | ☐ | |
| Community Manager | ☐ | ☐ | |
| AM Pilotage de marque | — | ☐ | |
| Communications internes | ☐ | ☐ | |
| Notifications | — | ☐ | |
| Bugs auto-capture | — | ☐ | |
| WhatsApp client | ☐ | ☐ | |
| Projets collaboratifs | — | ☐ | |

**Résultat attendu** : `10/12` minimum en test rapide, `12/12` en test complet.

---

## 13. En cas de problème

Chaque erreur laisse une trace dans **Administration → Bugs & incidents** avec badge violet « Auto ». Envoyez-nous l'ID (ex `#42`) et nous pourrons diagnostiquer sans que vous ayez à décrire le contexte.

Pour des questions sur ce guide :
- Consultez `docs/working-method-audit.md` pour comprendre l'architecture générale.
- Ping direct sur l'équipe dev.
