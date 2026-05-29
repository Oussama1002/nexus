<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Lead;
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
        $brandId = ApiBrandContext::resolveBrandId($request);
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

        $convBase = Conversation::query()->where('brand_id', $brandId)->where('assigned_user_id', $targetId);

        $conversationsTotal = (clone $convBase)->count();

        $leadsBase = Lead::query()->where('brand_id', $brandId)->where('assigned_user_id', $targetId);
        $leadsOpen = (clone $leadsBase)->whereNotIn('status', ['lost', 'archived', 'confirmed'])->count();
        $leadsNew = (clone $leadsBase)->where('status', 'new')->count();

        $ordersBase = Order::query()->where('brand_id', $brandId)->where('assigned_user_id', $targetId);
        $ordersConfirmed = (clone $ordersBase)->where('status', 'confirmed')->count();
        $ordersCancelled = (clone $ordersBase)->where('status', 'cancelled')->count();
        $ordersPending = (clone $ordersBase)->where('status', 'pending')->count();
        $ordersTotal = (clone $ordersBase)->count();

        $remindersScoped = Reminder::query()
            ->where('assigned_user_id', $targetId)
            ->where('status', 'pending')
            ->where('remind_at', '<=', now())
            ->where(function ($q) use ($brandId) {
                $q->whereHas('conversation', fn ($c) => $c->where('brand_id', $brandId))
                    ->orWhereHas('lead', fn ($l) => $l->where('brand_id', $brandId));
            });

        $remindersDue = (clone $remindersScoped)->count();

        $recentReminders = (clone $remindersScoped)
            ->orderBy('remind_at')
            ->limit(10)
            ->get(['id', 'title', 'remind_at']);

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
            'reminders' => $recentReminders->map(fn ($r) => [
                'id' => (string) $r->id,
                'at' => $r->remind_at->format('H:i'),
                'label' => $r->title,
                'meta' => '',
            ]),
        ], 'Workspace summary retrieved successfully.');
    }
}
