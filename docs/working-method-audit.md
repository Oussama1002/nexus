# Working-method audit

Patterns across the last 50 commits (branch depth), backend routes/console/bootstrap, the biggest controllers and services, and 3–4 recently-added modules read end-to-end (AM, CM, SMM, Communications internes / Bugs & incidents).

## Where the pattern is consistent

- **Phased, spec-driven rollout.** AM shipped in 6 phases, SMM in 3, CM in 4. Each phase ends with a "close spec gaps" commit referencing a numbered section (`§7.3`, `§7.4`, `§15`). Strongest signal in the repo.
- **Brand scoping.** 121 controllers use `ApiBrandContext::resolveBrandId` / `::scopeBrand`. Zero raw `->where('brand_id', ...)` survive.
- **Permissions.** 647 `middleware('permission:<slug>')` entries, all named `<module>.<action>`. Single `CheckPermission` middleware.
- **Auditing.** 93 controllers call `AuditLogger::log`; only one direct `audit_logs` write anywhere.
- **Error handling.** Centralised in `bootstrap/app.php`: renderers for `Validation`/`Auth`/`NotFound`, `BugAutoReporter::capture` on every Throwable, `GlobalErrorBoundary` on the frontend posting to `/api/bugs-incidents/report-client`. Only 44 `try {` blocks in all API controllers — they stay thin.
- **Commit style.** `Module: what changed` or `Fix X`. Reads well in `git log --oneline`.

## Where it drifts

- **Tests are effectively absent.** 3 PHP test files in the whole backend. Zero `*.test.*` / `*.spec.*` under `frontend/src`. `npm run lint` is `tsc --noEmit` — the only automated check.
- **TypeScript strictness off.** `tsconfig.json` has no `strict`, no `noImplicitAny`. 29 `@ts-ignore` / `@ts-expect-error` / `as any` in the frontend. Six pre-existing TS errors carried across pushes.
- **Cron vs command inventory.** 13 Artisan commands, 8 scheduled. One-shots rightly stay off, but `GenerateDailyKpisCommand` and `SyncShipmentsCommand` look like they should be on a schedule and aren't.
- **`am.gate` middleware aliased in `bootstrap/app.php` but referenced zero times in `routes/api.php`.** Wiring skipped or alias dead.
- **Uncommitted `AutomationEngineService.php` on the deploy target.** Not on this branch — rotting only there. Same shape as the untracked local notes flagged in the brief.

## Debt accruing

- TS suppressions and the six known TS errors move with each feature push and never get burned down.
- Two `.gitignore` files, 73 + 309 bytes total. Whatever the local notes are, they're one entry away from being tracked.
- Only 2 `TODO`/`FIXME` comments in the entire codebase — known-shaky spots (AutomationEngineService drift, the TS-error list, unwired commands) live in your head, not the code.
- Big single-file services/controllers: `CommunityManagerController` 768 lines, `SettingsCenterService` 706, `DashboardNotificationService` 500. Each phase adds more.

## Naming / file-org inconsistencies

- Sub-namespaced service dirs exist for `Am/`, `Smm/`, `Delivery/`, `Meta/`, `Tiktok/`, but sibling modules keep top-level services (`CmNotificationService`, `DashboardNotificationService` at root). No rule for when a module gets its own folder.
- Controllers flat under `Api/`; only `Academy/` got namespaced, and a legacy `AcademyLessonController` still sits alongside `Academy\LessonController` — the `use ... as LegacyAcademyLessonController` in the route file is the tell.
- Frontend `screens/` is flat (64 files), while `components/` is split by domain (`chat/`, `hr/`, `social/`, …).

## Same problem solved several ways

- **Messaging is the worst.** Six models: `ChatConversation`, `ChatConversationMember`, `Conversation`, `Message`, `InternalMessage`, `InfluencerMessage`. `InternalChatController` (394 lines), `ConversationController` (408), plus `InfluencerMessageController`. Communications internes was rebuilt at least twice in the last 15 commits, each time reshaping the same tables.
- **Notifications.** `DashboardNotificationService` (500 lines, generic), `CmNotificationService`, `Am/AmNotificationService`, `Smm/SmmNotificationService`. Four services with overlapping intent, no shared interface.
- **Brand-optional retrofits.** `make_automation_brand_id_nullable`, `make_collab_projects_brand_id_nullable`, and "brand-optional" retrofits for Bugs and Collab — same decision made per-module. Phase 1 spec §7.4 tried to formalise it but retrofits keep landing.
- **Enum → French label mapping.** Done at least 4 times in the last 20 commits, ad-hoc per screen (shipment statuses, order source, AM Config list cells, "render list cells in French, no raw JSON").

## Summary

You spec, phase, brand-scope, permission-gate, and audit-log consistently — that's the backbone. The gaps: no test safety net, TS strictness off with suppressions accumulating, notifications and messaging duplicated across modules, brand-optional retrofitted rather than opted-into by default, enum→FR labels re-invented per screen, and known-shaky spots tracked in your head instead of the code.
