<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\CustomerFollowUp;
use App\Models\Lead;
use App\Models\Message;
use App\Models\Order;
use App\Models\Reminder;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ConfirmatriceWorkspaceController extends Controller
{
    /**
     * KPI + queues for the confirmatrice workspace (scoped by active brand).
     */
    public function summary(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $targetId = (int) $request->query('user_id');
        if ($targetId < 1) {
            return ApiResponse::error('user_id is required.', ['user_id' => ['Invalid']], 422);
        }

        $actor = $request->user();
        if (! $actor) {
            throw new AccessDeniedHttpException('Unauthenticated.');
        }

        $actor->loadMissing('roles');

        if ((int) $actor->id !== $targetId && ! $actor->isAdmin() && ! $actor->isManagerOperational()) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $convBase = Conversation::query()->where('assigned_user_id', $targetId);
        ApiBrandContext::scopeBrand($convBase, $brandId);

        $conversationsTotal = (clone $convBase)->count();

        $leadsBase = Lead::query()->where('assigned_user_id', $targetId);
        ApiBrandContext::scopeBrand($leadsBase, $brandId);
        $leadsOpen = (clone $leadsBase)->whereNotIn('status', ['lost', 'archived', 'confirmed'])->count();
        $leadsNew = (clone $leadsBase)->where('status', 'new')->count();

        $ordersBase = Order::query()->where('assigned_user_id', $targetId);
        ApiBrandContext::scopeBrand($ordersBase, $brandId);
        $ordersConfirmed = (clone $ordersBase)->where('status', 'confirmed')->count();
        $ordersCancelled = (clone $ordersBase)->where('status', 'cancelled')->count();
        $ordersPending = (clone $ordersBase)->where('status', 'pending')->count();
        $ordersTotal = (clone $ordersBase)->count();

        $remindersScoped = Reminder::query()
            ->where('assigned_user_id', $targetId)
            ->where('status', 'pending')
            ->where('remind_at', '<=', now());
        if ($brandId !== null) {
            $remindersScoped->where(function ($q) use ($brandId) {
                $q->whereHas('conversation', fn ($c) => $c->where('brand_id', $brandId))
                    ->orWhereHas('lead', fn ($l) => $l->where('brand_id', $brandId));
            });
        }

        $remindersDue = (clone $remindersScoped)->count();

        $recentReminders = (clone $remindersScoped)
            ->orderBy('remind_at')
            ->limit(10)
            ->get(['id', 'title', 'remind_at']);

        // Satisfaction rate: confirmed / (confirmed + cancelled) as percentage
        $satisfactionDenom = $ordersConfirmed + $ordersCancelled;
        $satisfactionRate = $satisfactionDenom > 0
            ? round(100 * $ordersConfirmed / $satisfactionDenom, 1)
            : 0;

        // Follow-up rate: reminders completed / total reminders for this user & brand
        $remindersTotalQ = Reminder::query()
            ->where('assigned_user_id', $targetId);
        if ($brandId !== null) {
            $remindersTotalQ->where(function ($q) use ($brandId) {
                $q->whereHas('conversation', fn ($c) => $c->where('brand_id', $brandId))
                    ->orWhereHas('lead', fn ($l) => $l->where('brand_id', $brandId));
            });
        }
        $remindersTotal = $remindersTotalQ->count();
        $remindersDoneQ = Reminder::query()
            ->where('assigned_user_id', $targetId)
            ->whereNotNull('completed_at');
        if ($brandId !== null) {
            $remindersDoneQ->where(function ($q) use ($brandId) {
                $q->whereHas('conversation', fn ($c) => $c->where('brand_id', $brandId))
                    ->orWhereHas('lead', fn ($l) => $l->where('brand_id', $brandId));
            });
        }
        $remindersDone = $remindersDoneQ->count();
        $followUpRate = $remindersTotal > 0
            ? round(100 * $remindersDone / $remindersTotal, 1)
            : 0;

        return ApiResponse::success([
            'conversations_total' => $conversationsTotal,
            'leads_open' => $leadsOpen,
            'leads_new' => $leadsNew,
            'orders_confirmed' => $ordersConfirmed,
            'orders_cancelled' => $ordersCancelled,
            'orders_pending' => $ordersPending,
            'orders_total' => $ordersTotal,
            'reminders_due' => $remindersDue,
            'upsells_open' => 0,
            'satisfaction_rate' => $satisfactionRate,
            'follow_up_rate' => $followUpRate,
            'reminders' => $recentReminders->map(fn ($r) => [
                'id' => (string) $r->id,
                'at' => $r->remind_at->format('H:i'),
                'label' => $r->title,
                'meta' => '',
            ]),
        ], 'Workspace summary retrieved successfully.');
    }

    /**
     * Rapport quotidien automatique (spec §6.7). Calculé sur les commandes de
     * l'agente pour la période choisie (aujourd'hui par défaut).
     *
     * Note : les indicateurs d'appels (appels effectués, décrochés, personnes
     * appelées, taux de joignabilité) nécessitent une journalisation des appels
     * qui n'existe pas encore — ils ne sont pas calculés ici.
     */
    public function dailyReport(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $actor = $request->user();
        if (! $actor) {
            throw new AccessDeniedHttpException('Unauthenticated.');
        }

        $targetId = (int) $request->query('user_id', (int) $actor->id);
        $actor->loadMissing('roles');
        if ($targetId !== (int) $actor->id && ! $actor->isAdmin() && ! $actor->isManagerOperational()) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        // Période : today | yesterday | week | month | last_month | custom (défaut today).
        $period = (string) $request->query('period', 'today');
        [$from, $to] = $this->periodRange($period, $request->query('from'), $request->query('to'));

        $base = Order::query()->where('assigned_user_id', $targetId);
        ApiBrandContext::scopeBrand($base, $brandId);
        $base->whereBetween('created_at', [$from, $to]);

        $byStatus = (clone $base)
            ->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status');

        $byOrigin = (clone $base)
            ->selectRaw("COALESCE(NULLIF(source, ''), 'Non précisé') as origin, COUNT(*) as c")
            ->groupBy('origin')
            ->orderByDesc('c')
            ->get()
            ->map(fn ($r) => ['origin' => $r->origin, 'count' => (int) $r->c]);

        $total = (int) (clone $base)->count();
        $confirmed = (int) ($byStatus['confirmed'] ?? 0);

        // Messages reçus : messages entrants des conversations de l'agente.
        $messagesReceived = (int) Message::query()
            ->where('direction', 'inbound')
            ->whereBetween('sent_at', [$from, $to])
            ->whereHas('conversation', function ($c) use ($targetId, $brandId) {
                $c->where('assigned_user_id', $targetId);
                if ($brandId !== null) {
                    $c->where('brand_id', $brandId);
                }
            })
            ->count();

        // Double confirmation sur les commandes de l'agente (toutes périodes).
        $dcBase = Order::query()->where('assigned_user_id', $targetId);
        ApiBrandContext::scopeBrand($dcBase, $brandId);
        $dcPending = (int) (clone $dcBase)->where('double_confirmation_status', 'pending')->count();
        $dcDone = (int) (clone $dcBase)->where('double_confirmation_status', 'done')->count();

        // Fidélisation : ventes additionnelles sur la période.
        $fuBase = CustomerFollowUp::query()->where('assigned_user_id', $targetId)->whereBetween('completed_at', [$from, $to]);
        if ($brandId !== null) {
            $fuBase->where('brand_id', $brandId);
        }
        $upsellTotal = (float) (clone $fuBase)->sum('upsell_amount');

        // Taux de confirmation : confirmées / messages reçus (calcul GO-CENTER),
        // repli sur confirmées / total commandes si aucun message.
        $confirmationRate = $messagesReceived > 0
            ? round(100 * $confirmed / $messagesReceived, 1)
            : ($total > 0 ? round(100 * $confirmed / $total, 1) : 0);

        return ApiResponse::success([
            'period' => $period,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'messages_received' => $messagesReceived,
            'orders_total' => $total,
            'orders_confirmed' => $confirmed,
            'orders_pending' => (int) ($byStatus['pending'] ?? 0),
            'orders_cancelled' => (int) ($byStatus['cancelled'] ?? 0),
            'orders_scheduled' => (int) ($byStatus['scheduled'] ?? 0),
            'orders_postponed' => (int) ($byStatus['postponed'] ?? 0),
            'orders_shipped' => (int) ($byStatus['shipped'] ?? 0),
            'orders_delivered' => (int) ($byStatus['delivered'] ?? 0),
            'orders_returned' => (int) ($byStatus['returned'] ?? 0),
            'double_confirmation_pending' => $dcPending,
            'double_confirmation_done' => $dcDone,
            'upsell_amount' => $upsellTotal,
            'confirmation_rate' => $confirmationRate,
            'by_origin' => $byOrigin,
            // Indicateurs d'appels non disponibles sans journalisation des appels.
            'calls_available' => false,
        ], 'Rapport quotidien.');
    }

    /**
     * @return array{0: \Illuminate\Support\Carbon, 1: \Illuminate\Support\Carbon}
     */
    private function periodRange(string $period, ?string $from = null, ?string $to = null): array
    {
        $now = now();

        if ($period === 'custom' && $from) {
            try {
                $start = \Illuminate\Support\Carbon::parse($from)->startOfDay();
                $end = $to ? \Illuminate\Support\Carbon::parse($to)->endOfDay() : $now->copy()->endOfDay();

                return [$start, $end];
            } catch (\Throwable) {
                // Repli sur aujourd'hui si les dates sont invalides.
            }
        }

        return match ($period) {
            'yesterday' => [$now->copy()->subDay()->startOfDay(), $now->copy()->subDay()->endOfDay()],
            'week' => [$now->copy()->startOfWeek(), $now->copy()->endOfDay()],
            'month' => [$now->copy()->startOfMonth(), $now->copy()->endOfDay()],
            'last_month' => [$now->copy()->subMonthNoOverflow()->startOfMonth(), $now->copy()->subMonthNoOverflow()->endOfMonth()],
            default => [$now->copy()->startOfDay(), $now->copy()->endOfDay()],
        };
    }
}
