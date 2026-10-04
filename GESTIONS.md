# Nexus — Catalogue des gestions (modules & opérations)

Ce document décrit **toutes les “gestions” du système** (ce qui est géré, par qui, et via quels écrans/actions), basé sur l’état actuel de l’app (UI + navigation + tracking local).

## 1) Rôles & accès (sessions)

- **Admin**
  - Accès: presque tous les modules (commerce, opérations, management, configuration, historique).
  - Spécificité: peut ouvrir **Espace Confirmatrice** en mode supervision et **sélectionner** une confirmatrice.
- **Manager**
  - Accès: modules opérationnels + management (reporting/finance/tracking/settings), sans RH admin avancé.
- **Confirmatrice**
  - Accès limité: **Votre espace**, Conversations (WhatsApp), Leads, Commandes, Nouvelle commande.
  - **Pas d’accès**: Historique/Tracking (désactivé), RH, Reporting/Finance admin, etc.

> L’accès est filtré par rôle (sidebar + garde d’accès) dans `src/App.tsx`.

## 2) Contexte global (systèmes transverses)

### 2.1 Multi‑marques (Marque = “session”)
- **Ce que le système gère**
  - Une **marque active** globale (contexte de travail) persistée (localStorage).
  - Les écrans utilisent la marque active **par défaut** (ex: création commande).
- **Où**
  - Pill “brand” en topbar (switcher), et module `Marques`.

### 2.2 Tracking / audit (Historique système)
- **Ce que le système gère**
  - Un flux d’événements `nexus.sessions` (localStorage) via `trackSession()`.
  - Navigation, actions WhatsApp, création commande, settings save, sélection confirmatrice (admin), etc.
- **Où**
  - Module `Historique / Tracking` (`src/screens/TrackingScreen.tsx`)
  - Export JSON/CSV, filtres (module/action/date/search), timeline groupée.

### 2.3 Configuration (centre système)
- **Ce que le système gère**
  - Paramètres globaux (General/Entreprise/WhatsApp/Marques/Commandes/Livraisons/Stocks/Notifications/Users/Finance)
  - Barre de sauvegarde + état “non enregistré”
- **Où**
  - `Configuration` (`src/screens/SettingsScreen.tsx`)

## 3) Gestions par module

### 3.1 Dashboard (Tableau de bord)
- **Gestion**
  - KPIs et vues synthèse (placeholders graphiques)
  - Zone “Campagnes & sources” (placeholders)
- **Actions**
  - Changement de période (Aujourd’hui/Semaine/Mois/Année)
- **Écran**
  - `src/screens/DashboardScreen.tsx`

### 3.2 Votre espace (Confirmatrice)
- **Gestion**
  - Poste de travail quotidien: conversations, leads, confirmations, relances, upsells, performance.
  - **Admin**: supervision via sélection confirmatrice.
- **Widgets / opérations**
  - Reminders due today, upsell requests, queues opérationnelles, raccourcis.
- **Écran**
  - `src/screens/ConfirmatriceSpaceScreen.tsx`

### 3.3 Conversations (WhatsApp workspace)
- **Gestion**
  - Liste conversations + tags + statut (Nouveau/En cours/Confirmé/Annulé/Livré)
  - Messagerie (envoi message)
  - Lead sheet **en popup** (Drawer) via bouton **“Fiche lead”** dans l’en‑tête chat
- **Actions clés**
  - Rechercher, filtrer par tag
  - Changer statut: **C** confirmer / **X** annuler / **R** rappel
  - Créer commande depuis la fiche lead (pré‑remplissage)
  - Notes internes + rappel heure
- **Écran**
  - `src/screens/WhatsAppWorkspaceScreen.tsx`

### 3.4 Leads (gestion dédiée)
- **Gestion**
  - Pipeline leads: nouveau / en cours / confirmés / perdus / etc.
  - Filtrage marque/statut/source/confirmatrice + recherche
  - Détail lead (drawer): actions + placeholders timeline/reminders/notes
- **Actions clés**
  - Ouvrir conversation
  - Créer commande depuis lead (pré‑fill)
  - Programmer rappel / marquer perdu (placeholder)
- **Écran**
  - `src/screens/LeadsScreen.tsx`

### 3.5 Commandes (Orders)
- **Gestion**
  - Liste commandes + filtres + détail (v1)
  - Création commande (fast entry)
  - Marque de commande = **marque active (session)** (pas de sélection manuelle)
- **Actions clés**
  - Nouvelle commande
  - Création depuis WhatsApp/Lead
- **Écrans**
  - Liste: `src/screens/OrdersListScreen.tsx`
  - Création: `src/screens/OrdersNewScreen.tsx`

### 3.6 Livraison (Delivery management)
- **Gestion**
  - KPI livraison + onglets: sociétés, livreurs, paiements, stats
  - Tables + drawers (société / livreur)
- **Actions clés**
  - Suivi performance + paiements (placeholders)
- **Écran**
  - `src/screens/DeliveryScreen.tsx`

### 3.7 Suivi colis (Tracking Parcels)
- **Gestion**
  - Vue “suivi colis” (actuellement réutilise Expéditions v1)
- **Écran**
  - `trackingParcels` → `src/screens/ShipmentsScreen.tsx` (réutilisé)

### 3.8 Fournisseurs (Suppliers / Procurement)
- **Gestion**
  - Table fournisseurs + drawer fournisseur
  - Commandes fournisseurs (PO) table liée (réf, statut, montant, reçu, paiement)
  - Modal create/edit fournisseur
- **Actions clés**
  - Upsert fournisseur
  - Visualiser l’historique PO par fournisseur
- **Écran**
  - `src/screens/SuppliersScreen.tsx`

### 3.9 Marques (Brands)
- **Gestion**
  - Table marques + drawer marque + modal create/edit
  - Définir marque **active**
- **Écran**
  - `src/screens/BrandsScreen.tsx`

### 3.10 Campagnes Ads
- **Gestion**
  - KPI campagnes, filtres (marque/statut/source), table campagnes
  - Drawer campagne + modal create/edit
- **Note**
  - Les 3 cartes graphiques “commandes/leads/coût” sont sur le **Dashboard** (placeholders).
- **Écran**
  - `src/screens/AdsScreen.tsx`

### 3.11 Reportings (centre analytique)
- **Gestion**
  - KPIs (CA, profit, commandes, colis, produits vendus, clients)
  - Filtres marque/source/confirmatrice + export CSV (PDF/Excel placeholders)
  - Sections + placeholders graphiques
- **Écran**
  - `src/screens/ReportingScreen.tsx`

### 3.12 Finance
- **Gestion**
  - Charges: ajout + table + filtres (v1)
  - Placeholders paiements/factures/marge (selon l’écran)
- **Écran**
  - `src/screens/FinanceScreen.tsx`

### 3.13 RH / Supervision équipe
- **Gestion**
  - KPI RH, équipes/collaborateurs, table + drawer profil
- **Écran**
  - `src/screens/HrScreen.tsx`

### 3.14 Configuration (centre système)
- **Gestion**
  - Général, Entreprise, WhatsApp, Marques, Commandes, Livraisons, Stocks, Notifications, Users, Finance
  - Save bar + “unsaved changes”
- **Écran**
  - `src/screens/SettingsScreen.tsx`

### 3.15 Historique / Tracking
- **Gestion**
  - Timeline d’audit (groupée par jour), filtres, export JSON/CSV
- **Écran**
  - `src/screens/TrackingScreen.tsx`

## 4) Données clés gérées (domain objects)

- **Brand**: `src/types.ts`
- **User (role)**: `src/types.ts`
- **Lead**: `src/types.ts`
- **Order / OrderDraft**: `src/domain/orders.ts`
- **Shipment**: `src/domain/shipments.ts`
- **Product**: `src/domain/products.ts`
- **Charge**: `src/domain/finance.ts`

## 5) Exports disponibles (actuels)
- **Tracking**: JSON + CSV
- **Reporting**: CSV (PDF/Excel placeholders)

## 6) Patterns UI (standard du système)
- KPI cards en tête → `FilterBar` → `DataTable` → `Drawer` (détail) → `Modal` (create/edit)
- Toutes les actions importantes doivent émettre un event `trackSession({ name: 'audit.<module>.<action>', ... })`

