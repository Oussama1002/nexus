# AGENTS.md — How to work on Brandna CRM

Read this before touching code. It is the short, operational playbook every agent follows.
For deep context (module map, WhatsApp internals, leads policy) see [CLAUDE.md](CLAUDE.md) — this file is the "how to code", that one is the "what exists".

---

## 1. What this project is

**Brandna CRM** — multi-brand e-commerce CRM for a Moroccan brand (DTC Galaxy / Medicaldine).
Shipped directly to production for a real client. There is no staging. Treat every change as going live.

- **Stack**: Laravel 13 (PHP) + React 18 + TypeScript + Vite.
- **Backend**: `backend/` — Composer, artisan, migrations, API only.
- **Frontend**: `frontend/` — Vite dev on `:5173`, build outputs to `frontend/dist/`.
- **Local dev**: `C:\xampp2\htdocs\nexus` on XAMPP (Windows).

---

## 2. Golden rules (do not break these)

1. **All UI text is in French.** Verbose French labels ("Modèles de messages", "Fenêtre 24 h expirée…"). Never introduce English UI strings. Code identifiers stay English.
2. **Minimal changes.** No gratuitous refactors, no reformatting untouched lines, no comments on obvious code. Change only what the task needs.
3. **Match the surrounding code** — naming, idiom, comment density, structure. Read the neighbors before you write.
4. **Commit + push + deploy after every change** (see §6). This is a standing instruction from the user.
5. **Deploy target is ONLY** `/home/dtcgalaxy/htdocs/dtcgalaxy.ma`. Never `/var/www/html/nexus`, never any other server.
6. **Never prepend `ssh …` to deploy commands** — the user is already SSH-connected. Hand over the raw `cd … && git pull && …` block.
7. **Idempotent migrations** — always guard with `Schema::hasTable(...)` / `Schema::hasColumn(...)`. Prefer `VARCHAR` over `ENUM` for status columns.

---

## 3. Backend conventions (Laravel)

- **Brand scoping**: every scoped controller resolves the active brand from the `X-Brand-Id` header:
  ```php
  $brandId = App\Support\ApiBrandContext::resolveBrandId($request, required: true);
  ```
  Throws 422 "Active brand is required" when missing and required.
- **Responses** always use the envelope:
  ```php
  return App\Support\ApiResponse::success($data, $message, $status); // {success, message, data}
  return App\Support\ApiResponse::error($message, $status);
  ```
- **Permissions**: protect routes with middleware `permission:module.action` (e.g. `permission:conversations.view`, `permission:settings.update`).
- **Audit**: `AuditLogger::log($request, $action, $entity, $before, $after)` for user-driven actions; `AuditLogger::system(...)` for automated ones.
- **New endpoint checklist**:
  1. Route in `backend/routes/api.php` (with the right `permission:` middleware).
  2. Controller in `backend/app/Http/Controllers/Api/`.
  3. Resolve brand via `ApiBrandContext`.
  4. Return via `ApiResponse`.
  5. Audit log if it mutates data.
- **WhatsApp / Meta**: `App\Services\WhatsAppCloudService` (Cloud API v25.0). Translate Meta errors to French with `App\Services\Meta\MetaErrorTranslator::toFrench($raw, $code)`.

## 4. Frontend conventions (React + TS)

- **API client**: `src/lib/api.ts` — `api.get/post/put/patch/del(path, body?, { brandId? })`. It sends `X-Brand-Id` automatically from `localStorage['nexus_active_brand_id']`. Pass `{ brandId: false }` to force-omit.
- **Brand context**: `useBrand()` from `src/context/BrandContext.tsx` → `{ activeBrandId, activeBrand }`. `activeBrandId` may be a numeric id, `'all'`, or `null` — handle all three.
- **Auth**: `useAuth()` → `hasPermission('module.action')`, `roleSlugs`, `user`. Gate UI on `hasPermission`.
- **Toast**: `useToast()` for user feedback (French messages).
- **Shared UI**: reuse `src/components/ui/` (StatusChip, Modal, EmptyState, …) before building new. Style with Tailwind.
- **Screens** live as `*Screen.tsx`; settings panels in `components/settings/center/CenterPanels.tsx`.
- **Print / PDF**: set `document.body.dataset.printMode = 'report'` then `window.print()`; styles in `src/index.css` under `@media print`.

---

## 5. Where to look first

| Task | Start here |
|---|---|
| WhatsApp feature | `WhatsAppWorkspaceScreen.tsx` + `ConversationController` + `WhatsAppCloudService` |
| New backend endpoint | `backend/routes/api.php` + `backend/app/Http/Controllers/Api/` |
| UI polish | `frontend/src/components/ui/` + Tailwind classes |
| Settings panel | `components/settings/center/CenterPanels.tsx`, wired in `SettingsScreen.tsx` |
| Something broken in prod | `laravel.log` at `backend/storage/logs/laravel.log` on the client server |

Full module → screen map is in [CLAUDE.md](CLAUDE.md).

---

## 6. Commit, push, deploy

**Commits**: concise French subject line describing the change. End the message with:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

**Flow after any change**: commit → push to `main` → hand the user the deploy command. Don't ask permission for well-scoped changes.

**Deploy commands** (paste the matching one — no `ssh` prefix):

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

---

## 7. Communication style

- The user (**oussama**) is the solo dev/PO. Direct answers, no ceremony, no "let me think about it" — ship the fix.
- The user writes in Franglais/darija; chat replies in English, CRM UI stays French.
- If something is off the user will say "wtf" / "nooo" — read the correction, apply it, move on.
- Report outcomes honestly: if a build or migration fails, say so with the output. Don't claim done until it is.
