# Project Progress — Nexus CRM/ERP (Multi-brand)

Last updated: 2026-04-21

This document tracks **what’s built**, **what’s in progress**, and **what’s next** for the multi-brand Moroccan e‑commerce operations CRM/ERP.

## Status legend
- **Done**: Implemented UI + basic interactions (TypeScript passes).
- **In progress**: Implemented partially or implemented as v1 placeholder needing upgrades.
- **Not started**: Not yet implemented in the current UI.

## Modules overview

### Core shell / design system
- **Design tokens / base UI**: **Done**
  - Tokens + utilities in `src/index.css` (`.card`, `.card-muted`, semantic colors, radii, shadows).
- **Reusable UI primitives**: **Done**
  - `PageHeader`, `FilterBar`, `DataTable`, `Modal`, `Drawer`, `EmptyState`, `StatusChip`.
- **App shell (sidebar/topbar/layout)**: **Done**
  - `src/components/shell/AppShell.tsx`, `SidebarNav.tsx`, `Topbar.tsx`.
- **Tracking/audit event pipeline**: **Done (basic)**
  - Audit events recorded via `trackSession()` into `localStorage["nexus.sessions"]`.
- **Tracking UI (“Historique”)**: **Not started**
  - The view exists in navigation but currently uses placeholder output.

### Dashboard
- **Dashboard screen**: **Done (v1)**
  - `src/screens/DashboardScreen.tsx` (KPIs + analytics placeholders).
- **Analytics charts (real)**: **Not started**
  - Needs actual chart cards + data adapters (or backend integration).

### Orders (Commandes)
- **Orders list + filters + detail drawer**: **Done (v1)**
  - `src/screens/OrdersListScreen.tsx`
- **New order (fast entry) + totals + create**: **Done (v1)**
  - `src/screens/OrdersNewScreen.tsx`
- **Orders state (create → list)**: **Done**
  - Central state stored in `src/App.tsx` for now.
- **Order detail (full)**: **Not started**
  - Needs timeline, shipment/payment blocks, margin/cost breakdown, edits, history.

### WhatsApp Inbox / Confirmatrices workspace
- **3-column workspace**: **Done (v1)**
  - `src/screens/WhatsAppWorkspaceScreen.tsx`
- **WhatsApp → Orders (“Créer commande” prefill)**: **Done**
- **Keyboard shortcuts**: **Done**
  - C confirm / X cancel / R reminder (outside typing fields).
- **Operational upgrades**: **Not started**
  - Assign confirmatrice, “no answer”, upsell, task/reminder list, conversation status pipeline, real lead/order linking.

### Shipments / Logistics / Suivi colis
- **Expéditions list + filters + drawer + create modal**: **Done (v1)**
  - `src/screens/ShipmentsScreen.tsx`
- **Suivi colis**: **In progress**
  - Currently re-uses `ShipmentsScreen` under `trackingParcels`.
- **Carrier performance + delays + returns workflows**: **Not started**

### Products / Stock
- **Products & Stock combined screen**: **Done (v1)**
  - `src/screens/ProductsStockScreen.tsx`
- **Separate Stock module (movements/adjustments/history)**: **Not started**
- **Packaging products / packs**: **Not started**

### Suppliers
- **Suppliers module**: **Not started**
  - (Older demo code was replaced during shell refactor; needs re-implementation with new primitives.)

### Finance
- **Finance summary + charges table + add charge modal**: **Done (v1)**
  - `src/screens/FinanceScreen.tsx`, `src/domain/finance.ts`
- **Invoices (factures)**: **Not started**
- **Payments (paiements)**: **Not started**
- **Margins (gross/net), capital, reconciliation**: **Not started**

### Users / Access / Support
- **Users + roles + permissions**: **Not started**
- **Tickets**: **Not started**
- **Documentation / KB**: **Not started**

### Ads / Reporting / Settings / HR
- **Reporting**: **Not started**
- **Ads**: **Not started**
- **Settings**: **Not started**
- **HR (agents/performance)**: **Not started**

## Current implemented screens (quick index)
- `Dashboard`: `src/screens/DashboardScreen.tsx`
- `Orders list`: `src/screens/OrdersListScreen.tsx`
- `New order`: `src/screens/OrdersNewScreen.tsx`
- `WhatsApp workspace`: `src/screens/WhatsAppWorkspaceScreen.tsx`
- `Shipments`: `src/screens/ShipmentsScreen.tsx`
- `Products & Stock`: `src/screens/ProductsStockScreen.tsx`
- `Finance`: `src/screens/FinanceScreen.tsx`

## Next development priorities (recommended order)
1. **Tracking UI (“Historique”)**
2. **Orders deepening (order detail + timeline + edits)**
3. **Suivi colis (real parcel tracking views)**
4. **Suppliers + Purchase orders**
5. **Stock movements + adjustments + low-stock workflows**
6. **Finance: payments/invoices + margin + reconciliation**
7. **Users/roles/permissions**
8. **Reporting + scheduled exports**
9. **Documentation/KB**

## Upcoming tasks (actionable breakdown)

### Priority 1 — Tracking UI (“Historique”)
- **Create screen**: `src/screens/TrackingScreen.tsx`
- **Render timeline** from `localStorage["nexus.sessions"]`
  - Filters: module (orders/whatsapp/shipments/stock/finance), date range, free text (phone/orderId/tracking).
  - Grouping: by day, then event type.
- **Add export**
  - “Export JSON” and “Export CSV” for audit events.
- **Add event schemas**
  - Document event names and required `meta` fields.

### Priority 2 — Orders: full detail + operational actions
- **OrderDetail drawer/page**
  - Status timeline (confirmed/cancelled/returned/delivered)
  - Payment state + updates
  - Shipment link and actions (create shipment from order)
  - Costs + margin block (MAD)
- **Actions**
  - Confirm, cancel (require reason), refund, mark paid/partial
- **Data integrity**
  - Move order state out of `App.tsx` into `src/state/` (or context/store) once stable.

### Priority 3 — Suivi colis (real)
- **Dedicated screen**: `src/screens/ParcelTrackingScreen.tsx`
- **Views/tabs**
  - Retard, Retourné, Livré, En livraison
- **KPIs**
  - Delivery rate, return rate, avg delivery days (placeholders until backend)
- **Actions**
  - Mark delayed, mark returned, update status, open shipment drawer

### Priority 4 — Suppliers + purchase orders
- **Suppliers list + drawer**
  - status, rating, lead time, history
- **Purchase orders**
  - create PO, statuses (draft/sent/received/paid), received quantities, variance

### Priority 5 — Stock movements (true inventory ops)
- **Stock movements table**
  - product, delta, reason, user, timestamp
- **Adjustments**
  - modal with validation and audit event
- **Low stock workflow**
  - “Create purchase order” from low-stock items

### Priority 6 — Finance (end-to-end)
- **Invoices**
  - list + detail + status chips
- **Payments**
  - COD reconciliation, payment history
- **Margin**
  - gross/net margin cards, difference vs expected costs

## Notes for developers
- **Audit events**: use `trackSession({ name: 'audit.<module>.<action>', ts: Date.now(), meta: {...} })`
- **Pattern**: every module should follow **FilterBar → DataTable → Drawer → Modal(create)**.
- **Morocco**: keep MAD formatting, FR labels, +212 patterns, Casablanca ops language.

