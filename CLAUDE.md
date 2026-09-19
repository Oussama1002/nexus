# Brandna CRM — Context for Claude Code

## Project

**Brandna CRM** — Multi-brand e-commerce CRM for Moroccan brands (skincare, cosmetics).
Stack: **Laravel 13** (backend) + **React 18 + TypeScript + Vite** (frontend).
Repo: `github.com/Oussama1002/nexus` — user branch `main`.

- **Local dev**: `C:\xampp2\htdocs\nexus` on XAMPP (Windows).
- **Backend at**: `backend/` — Composer, artisan, migrations.
- **Frontend at**: `frontend/` — Vite dev on `:5173`, build outputs to `frontend/dist/`.

## Deploy target — VERY IMPORTANT

- **Client server ONLY**: `/home/dtcgalaxy/htdocs/dtcgalaxy.ma`
- **NEVER deploy to**: `/var/www/html/nexus`, main server, or anywhere else.
- The user is **already SSH-connected** to the client server — **never prepend `ssh …` to a deploy command**. Just paste the `cd /home/dtcgalaxy/htdocs/dtcgalaxy.ma && git pull && …` block.
- Standing instruction from the user: *"always commit and push and deploy"* — after any code change, commit + push, then hand over the deploy command.

## User & language

- User: **oussama** — solo developer/PO shipping directly to production for a client (DTC Galaxy / Medicaldine brand).
- **All UI text must be in French.** Existing convention: verbose French labels ("Modèles de messages", "Fenêtre 24 h expirée…"). Do not switch to English.
- User writes in Franglais/darija (e.g. "wtf", "cava"). Reply in the same casual French tone; keep technical content precise.
- Attribution on commits/PRs:
  ```
  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
  ```
  PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Architecture cheatsheet

### Backend

- **Brand scoping**: every scoped controller reads `X-Brand-Id` header via `App\Support\ApiBrandContext::resolveBrandId($request, required: true|false)`. Throws 422 "Active brand is required" when missing.
- **Response envelope**: `App\Support\ApiResponse::success($data, $message, $status)` → `{success, message, data}`. `ApiResponse::error(...)`.
- **Permissions**: middleware `permission:module.action` (e.g. `permission:conversations.view`, `permission:settings.update`).
- **Audit**: `AuditLogger::log($request, action, entity, before, after)` for user-driven, `AuditLogger::system(...)` for automated.
- **Migrations**: idempotent — always `if (Schema::hasTable(…))` / `if (Schema::hasColumn(…))`. Prefer `VARCHAR` over `ENUM` for status columns.
- **Meta / WhatsApp Cloud API v25.0**: `App\Services\WhatsAppCloudService`. Errors translated to French via `App\Services\Meta\MetaErrorTranslator::toFrench($raw, $code)`.

### Frontend

- **API client**: `src/lib/api.ts` — `api.get/post/put/patch/del(path, body?, {brandId?})`. Sends `X-Brand-Id` automatically from `localStorage['nexus_active_brand_id']`. Pass `{ brandId: false }` to force omit.
- **Brand context**: `useBrand()` from `src/context/BrandContext.tsx` → `{ activeBrandId, activeBrand }`. `activeBrandId` can be a numeric id, `'all'`, or `null`.
- **Auth**: `useAuth()` — `hasPermission('module.action')`, `roleSlugs`, `user`.
- **Toast**: `useToast()`.
- **Print / PDF export**: set `document.body.dataset.printMode = 'report'` then `window.print()`. CSS in `src/index.css` under `@media print`.

## Module map (main screens)

| French label | Screen file | Notes |
|---|---|---|
| Tableau de bord | `DashboardScreen.tsx` | KPIs, dashboard notifications |
| Notifications | `NotificationsScreen.tsx` | Full-page notif center (Critiques/Alertes/Infos/Succès) |
| Rapports | `ReportingScreen.tsx` | Global / Ads / Commercial / Stock / Livraison / Finance tabs |
| Conversations | `WhatsAppWorkspaceScreen.tsx` | WhatsApp workspace with template picker + status |
| Commandes | `OrdersScreen.tsx` | Orders CRUD + status flow |
| Nouvelle commande | `NewOrderScreen.tsx` | Order draft form |
| Clients | `CustomersScreen.tsx` | Customer list |
| Leads | `LeadsScreen.tsx` | Leads pipeline |
| Réclamations | `ComplaintsScreen.tsx` | Complaint tickets |
| Expéditions & suivi | `ShipmentsScreen.tsx` | Ameex / Sendit inbound sync |
| Communications internes | `InternalCommsScreen.tsx` | Internal chat with groups + attachments + typing indicator |
| Paramètres | `SettingsScreen.tsx` | Center panels: WhatsApp numbers, WhatsApp templates, delivery, meta, etc. |

## WhatsApp module — hot area, recent work

- **Templates management**: UI in `components/settings/center/CenterPanels.tsx` (`WhatsappTemplatesManager`), backend in `WhatsAppCloudService::fetchTemplates/createTemplate/deleteTemplate`, routes `GET/POST /api/whatsapp/templates`, `DELETE /api/whatsapp/templates/{name}`.
- **Send flow**: `ConversationController::sendTemplate` — frontend pre-renders body with `{{N}}` replaced and posts `preview_content` so the chat bubble immediately shows the rendered text instead of `[Modèle : name]`.
- **24h window**: WhatsApp Cloud refuses freeform text > 24h after last inbound. Frontend shows a warning banner + template picker button. Meta error `131047` translated in `MetaErrorTranslator`.
- **Payment error**: Meta error `131042` ("Business eligibility payment issue") = the WABA needs a payment method attached in business.facebook.com. Translated with clear French guidance.
- **Chat header height**: recently trimmed padding + card height (`calc(100dvh-5rem)`) for more message space.

## Leads auto-creation policy

- **WhatsApp** conversation → creates lead `source=WhatsApp`, `status=new` if customer has no lead. See `WhatsAppCloudService::findOrCreateCustomer` + `ensureWhatsappLead`.
- **Ameex/Sendit** inbound sync → creates lead `source=Ameex|Sendit`, `status=confirmed` (client already has a shipment, they're not a new prospect). See `AmeexInboundSyncService::ensureLead`, `SenditInboundSyncService::ensureLead`.
- Backfill migrations already ran on client server:
  - `2026_09_14_100000_backfill_leads_for_whatsapp_customers`
  - `2026_09_14_110000_backfill_leads_for_all_customers`
  - `2026_09_16_100000_promote_carrier_leads_to_confirmed`

## Open / unresolved issues

1. **502 on `POST /api/whatsapp/templates` (Nouveau modèle)** — proxy on client server returns Bad Gateway before Laravel responds. Backend HTTP timeout to Meta capped at 15s (commit `c0956ac`) to force JSON error instead of proxy HTML. If it still 502s after deploy, next step is checking `nginx/error.log`, `laravel.log`, and PHP-FPM status. Workaround: create templates directly in Meta Business Suite — they show up in the CRM at next refresh (list endpoint works fine).

## Deploy commands the user runs

Backend + frontend:
```bash
cd /home/dtcgalaxy/htdocs/dtcgalaxy.ma && git pull && cd backend && composer install --no-dev --optimize-autoloader && php artisan migrate --force && php artisan config:clear && cd ../frontend && npm ci && npm run build
```

Frontend only (fastest):
```bash
cd /home/dtcgalaxy/htdocs/dtcgalaxy.ma && git pull && cd frontend && npm run build
```

Migrations only:
```bash
cd /home/dtcgalaxy/htdocs/dtcgalaxy.ma && git pull && cd backend && php artisan migrate --force
```

## Ways the user pushes back

- Wants **minimal changes**, no gratuitous refactors, no comments on obvious code.
- Wants **direct answers** — no "let me think about it", no ceremony. Ship the fix.
- Will interrupt with "wtff" or "nooo" when something isn't going the way expected — read the correction, apply, move on.
- Prefers a **one-shot commit + push + deploy command** flow. Don't ask permission for well-scoped changes.

## Recent commits worth knowing

```
c0956ac WhatsApp templates: cap Meta call at 15s so 502 stops leaking through
cba8219 Reporting → Livraison: KPI par transporteur (Ameex, Sendit, …)
567245a Leads: carrier-imported clients start as confirmed, not new
a1cca13 WhatsApp templates: harden create against Meta slowness
a5431ce WhatsApp templates: accept both envelope and bare array shapes
6713d3f WhatsApp templates: stop refetch loop that broke the panel
5644fe6 WhatsApp templates: pass active brand id explicitly
b155830 WhatsApp: ensure every client conversation is also a lead
8856dac Delivery imports: auto-create leads for carrier-imported customers
```

## Where to look first

- **New feature request touches WhatsApp?** → `WhatsAppWorkspaceScreen.tsx` + `ConversationController` + `WhatsAppCloudService`.
- **New backend endpoint?** → route in `backend/routes/api.php` + controller in `backend/app/Http/Controllers/Api/` + `ApiBrandContext::resolveBrandId(...)` + `ApiResponse::success/error`.
- **UI polish?** → `frontend/src/components/ui/` (StatusChip, Modal, EmptyState, etc.) + Tailwind classes.
- **Settings panel change?** → `components/settings/center/CenterPanels.tsx`, wired up in `SettingsScreen.tsx` / `IntegrationsScreen.tsx`.
- **Something broken in prod?** → `laravel.log` at `/home/dtcgalaxy/htdocs/dtcgalaxy.ma/backend/storage/logs/laravel.log`.
