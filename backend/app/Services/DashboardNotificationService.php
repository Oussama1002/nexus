<?php

namespace App\Services;

use App\Models\AutomationRun;
use App\Models\ClientInvoice;
use App\Models\EmployeeAttendanceRecord;
use App\Models\Lead;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shipment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

class DashboardNotificationService
{
    private const SEVERITY_ORDER = ['danger' => 0, 'warning' => 1, 'info' => 2, 'success' => 3];
    private const PRIORITY_ORDER = ['P1' => 0, 'P2' => 1, 'P3' => 2];

    /** @return array{items: list<array<string, mixed>>, summary: array<string, int>} */
    public function forUser(User $user, int $limit = 30): array
    {
        $items = [];

        if ($user->hasPermissionSlug('orders.view')) {
            $items = array_merge($items, $this->pendingOrders($user));
            $items = array_merge($items, $this->bankTransfersToVerify($user));
        }

        if ($user->hasPermissionSlug('leads.view')) {
            $items = array_merge($items, $this->unassignedLeads($user));
        }

        if ($user->hasPermissionSlug('shipments.view') || $user->hasPermissionSlug('delivery.dashboard')) {
            $items = array_merge($items, $this->problemShipments($user));
            $items = array_merge($items, $this->deliveryIncidents($user));
        }

        if ($user->hasPermissionSlug('products.view') || $user->hasPermissionSlug('stock.view')) {
            $items = array_merge($items, $this->lowStockProducts($user));
            $items = array_merge($items, $this->outOfStockProducts($user));
        }

        if ($user->hasPermissionSlug('finance.view')) {
            $items = array_merge($items, $this->overdueInvoices($user));
        }

        if ($user->hasPermissionSlug('hr.view')) {
            $items = array_merge($items, $this->pendingHrJustifications($user));
        }

        if ($user->hasPermissionSlug('automations.view')) {
            $items = array_merge($items, $this->failedAutomations($user));
        }

        if ($user->hasPermissionSlug('orders.view') || $user->hasPermissionSlug('shipments.view')) {
            $items = array_merge($items, $this->returnedShipments($user));
        }

        usort($items, function (array $a, array $b) {
            $pa = self::PRIORITY_ORDER[$a['priority'] ?? 'P3'] ?? 9;
            $pb = self::PRIORITY_ORDER[$b['priority'] ?? 'P3'] ?? 9;
            if ($pa !== $pb) {
                return $pa <=> $pb;
            }
            $sa = self::SEVERITY_ORDER[$a['severity']] ?? 9;
            $sb = self::SEVERITY_ORDER[$b['severity']] ?? 9;
            if ($sa !== $sb) {
                return $sa <=> $sb;
            }

            return strcmp((string) ($b['occurred_at'] ?? ''), (string) ($a['occurred_at'] ?? ''));
        });

        $items = array_slice($items, 0, $limit);

        $summary = [
            'total' => count($items),
            'p1' => count(array_filter($items, fn ($i) => ($i['priority'] ?? '') === 'P1')),
            'p2' => count(array_filter($items, fn ($i) => ($i['priority'] ?? '') === 'P2')),
            'p3' => count(array_filter($items, fn ($i) => ($i['priority'] ?? '') === 'P3')),
            'danger' => count(array_filter($items, fn ($i) => $i['severity'] === 'danger')),
            'warning' => count(array_filter($items, fn ($i) => $i['severity'] === 'warning')),
        ];

        return ['items' => $items, 'summary' => $summary];
    }

    // ── P1 — Incidents critiques ──

    private function problemShipments(User $user): array
    {
        $q = Shipment::query()
            ->where(function (Builder $qq) {
                $qq->where('status', 'failed')
                    ->orWhere(function (Builder $q2) {
                        $q2->whereNotNull('sync_error')->where('sync_error', '!=', '');
                    });
            })
            ->orderByDesc('updated_at');

        $this->applyBrandScope($q, $user);

        if ($user->shouldRestrictShipmentsToAssignedOrders()) {
            $q->whereHas('order', fn (Builder $oq) => $oq->where('assigned_user_id', $user->id));
        }

        $count = (clone $q)->count();
        if ($count === 0) {
            return [];
        }

        $latest = (clone $q)->first();

        return [
            $this->item(
                'problem_shipments',
                'danger',
                'P1',
                'incident',
                $count > 1 ? "{$count} colis en échec" : 'Colis en échec',
                'Échec livraison ou erreur de synchronisation transporteur.',
                'trackingParcels',
                $latest?->updated_at ?? $latest?->created_at,
                $count,
            ),
        ];
    }

    private function failedAutomations(User $user): array
    {
        $q = AutomationRun::query()
            ->where('status', 'failed')
            ->where('created_at', '>=', Carbon::now()->subDays(7))
            ->orderByDesc('created_at');

        $this->applyBrandScope($q, $user);

        $count = (clone $q)->count();
        if ($count === 0) {
            return [];
        }

        $latest = (clone $q)->first();

        return [
            $this->item(
                'automation_failed',
                'danger',
                'P1',
                'incident',
                $count > 1 ? "{$count} automatisations en échec (7 j)" : 'Automatisation en échec',
                $latest?->result_message
                    ? mb_substr((string) $latest->result_message, 0, 120)
                    : 'Consultez les exécutions récentes.',
                'automations',
                $latest?->created_at,
                $count,
            ),
        ];
    }

    private function outOfStockProducts(User $user): array
    {
        $q = Product::query()
            ->where('stock_quantity', '<=', 0)
            ->where('status', 'active')
            ->orderBy('stock_quantity');

        $this->applyBrandScope($q, $user);

        $count = (clone $q)->count();
        if ($count === 0) {
            return [];
        }

        $latest = (clone $q)->first();

        return [
            $this->item(
                'out_of_stock',
                'danger',
                'P1',
                'incident',
                $count > 1 ? "{$count} produits en rupture de stock" : 'Produit en rupture',
                $latest?->name
                    ? "« {$latest->name} » — stock épuisé."
                    : 'Réapprovisionnement urgent.',
                'stock',
                $latest?->updated_at ?? $latest?->created_at,
                $count,
            ),
        ];
    }

    // ── P2 — Actions urgentes ──

    private function returnedShipments(User $user): array
    {
        $q = Shipment::query()
            ->where('status', 'returned')
            ->where('updated_at', '>=', Carbon::now()->subDays(7))
            ->orderByDesc('updated_at');

        $this->applyBrandScope($q, $user);

        $count = (clone $q)->count();
        if ($count === 0) {
            return [];
        }

        $latest = (clone $q)->first();

        return [
            $this->item(
                'returned_shipments',
                'warning',
                'P2',
                'livraison',
                $count > 1 ? "{$count} colis retournés (7 j)" : 'Colis retourné',
                'Colis retourné — action requise (relance, renvoi ou remboursement).',
                'trackingParcels',
                $latest?->updated_at,
                $count,
            ),
        ];
    }

    private function deliveryIncidents(User $user): array
    {
        $q = Shipment::query()
            ->whereIn('carrier_status', ['UNREACHABLE', 'POSTPONED', 'REFUSED'])
            ->whereNotIn('status', ['delivered', 'returned', 'cancelled'])
            ->where('updated_at', '>=', Carbon::now()->subDays(3))
            ->orderByDesc('updated_at');

        $this->applyBrandScope($q, $user);

        $count = (clone $q)->count();
        if ($count === 0) {
            return [];
        }

        $latest = (clone $q)->first();
        $statusLabel = match ($latest?->carrier_status) {
            'UNREACHABLE' => 'injoignable',
            'POSTPONED' => 'reportée',
            'REFUSED' => 'refusée',
            default => 'incident',
        };

        return [
            $this->item(
                'delivery_incidents',
                'warning',
                'P2',
                'livraison',
                $count > 1 ? "{$count} incidents livraison (3 j)" : "Livraison {$statusLabel}",
                "Destinataire {$statusLabel} — relance ou action requise.",
                'trackingParcels',
                $latest?->updated_at,
                $count,
            ),
        ];
    }

    private function pendingOrders(User $user): array
    {
        $q = Order::query()
            ->whereIn('status', ['draft', 'pending'])
            ->orderByDesc('updated_at');

        $this->applyBrandScope($q, $user);

        $count = (clone $q)->count();
        if ($count === 0) {
            return [];
        }

        $latest = (clone $q)->first();

        return [
            $this->item(
                'pending_orders',
                $count > 10 ? 'warning' : 'info',
                'P2',
                'notification',
                $count > 1 ? "{$count} commandes en attente" : 'Commande en attente',
                $count > 1
                    ? 'À confirmer ou traiter dans le module Commandes.'
                    : ($latest?->order_number ? "Commande {$latest->order_number}" : 'Une commande nécessite une action.'),
                'orders',
                $latest?->updated_at ?? $latest?->created_at,
                $count,
            ),
        ];
    }

    private function bankTransfersToVerify(User $user): array
    {
        $q = Order::query()
            ->where('bank_transfer_verification_status', 'pending')
            ->orderByDesc('bank_transfer_declared_at');

        $this->applyBrandScope($q, $user);

        $count = (clone $q)->count();
        if ($count === 0) {
            return [];
        }

        $latest = (clone $q)->first();

        return [
            $this->item(
                'bank_transfer_pending',
                'warning',
                'P2',
                'notification',
                $count > 1 ? "{$count} virements à vérifier" : 'Virement bancaire à vérifier',
                'Paiement déclaré — validation requise.',
                'orders',
                $latest?->bank_transfer_declared_at ?? $latest?->updated_at,
                $count,
            ),
        ];
    }

    private function overdueInvoices(User $user): array
    {
        $q = ClientInvoice::query()
            ->whereNotIn('status', ['paid', 'cancelled'])
            ->whereDate('due_date', '<', Carbon::today())
            ->orderBy('due_date');

        $this->applyBrandScope($q, $user);

        $count = (clone $q)->count();
        if ($count === 0) {
            return [];
        }

        $latest = (clone $q)->first();

        return [
            $this->item(
                'overdue_invoices',
                'warning',
                'P2',
                'reclamation',
                $count > 1 ? "{$count} factures en retard" : 'Facture en retard',
                $latest?->invoice_number
                    ? "Facture {$latest->invoice_number} — échéance dépassée."
                    : 'Relance ou encaissement à prévoir.',
                'finance',
                $latest?->due_date,
                $count,
            ),
        ];
    }

    private function lowStockProducts(User $user): array
    {
        $q = Product::query()
            ->whereColumn('stock_quantity', '<=', 'low_stock_threshold')
            ->where('low_stock_threshold', '>', 0)
            ->where('stock_quantity', '>', 0)
            ->orderBy('stock_quantity');

        $this->applyBrandScope($q, $user);

        $count = (clone $q)->count();
        if ($count === 0) {
            return [];
        }

        $latest = (clone $q)->first();

        return [
            $this->item(
                'low_stock',
                'warning',
                'P2',
                'notification',
                $count > 1 ? "{$count} produits en stock bas" : 'Stock bas',
                $latest?->name
                    ? "« {$latest->name} » — seuil atteint."
                    : 'Réapprovisionnement conseillé.',
                'stock',
                $latest?->updated_at ?? $latest?->created_at,
                $count,
            ),
        ];
    }

    // ── P3 — Informations ──

    private function unassignedLeads(User $user): array
    {
        $q = Lead::query()
            ->whereNull('assigned_user_id')
            ->whereNotIn('status', ['lost', 'archived', 'confirmed'])
            ->orderByDesc('created_at');

        $this->applyBrandScope($q, $user);

        $count = (clone $q)->count();
        if ($count === 0) {
            return [];
        }

        $latest = (clone $q)->first();

        return [
            $this->item(
                'unassigned_leads',
                'info',
                'P3',
                'notification',
                $count > 1 ? "{$count} leads non assignés" : 'Lead non assigné',
                'Affectez un commercial dans le module Leads.',
                'leads',
                $latest?->created_at,
                $count,
            ),
        ];
    }

    private function pendingHrJustifications(User $user): array
    {
        $q = EmployeeAttendanceRecord::query()
            ->where('justification_status', 'pending')
            ->whereIn('status', ['absent', 'late'])
            ->orderByDesc('attendance_date');

        $count = (clone $q)->count();
        if ($count === 0) {
            return [];
        }

        $latest = (clone $q)->first();

        return [
            $this->item(
                'hr_justification_pending',
                'info',
                'P3',
                'notification',
                $count > 1 ? "{$count} justificatifs RH en attente" : 'Justificatif RH en attente',
                'Absence ou retard à valider dans Ressources humaines.',
                'hr',
                $latest?->attendance_date,
                $count,
            ),
        ];
    }

    /** @return array<string, mixed> */
    private function item(
        string $id,
        string $severity,
        string $priority,
        string $category,
        string $title,
        string $body,
        ?string $link,
        mixed $occurredAt,
        int $count = 1,
    ): array {
        $at = $occurredAt instanceof Carbon
            ? $occurredAt
            : ($occurredAt ? Carbon::parse($occurredAt) : Carbon::now());

        return [
            'id' => $id,
            'severity' => $severity,
            'priority' => $priority,
            'category' => $category,
            'title' => $title,
            'body' => $body,
            'link' => $link,
            'count' => $count,
            'occurred_at' => $at->toIso8601String(),
        ];
    }

    private function applyBrandScope(Builder $query, User $user, string $column = 'brand_id'): void
    {
        if ($user->isAdmin()) {
            return;
        }

        $user->loadMissing('brands');
        $ids = $user->brands->pluck('id')->all();
        if ($ids !== []) {
            $query->whereIn($column, $ids);
        }
    }
}
