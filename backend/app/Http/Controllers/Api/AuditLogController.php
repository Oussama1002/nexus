<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Brand;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Supplier;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('audit_logs.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $userId = $request->query('user_id');
        $action = $request->query('action');
        $entityType = $request->query('entity_type');
        $entityId = $request->query('entity_id');
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = AuditLog::query()->with(['user'])->orderByDesc('created_at');
        if ($userId) {
            $q->where('user_id', (int) $userId);
        }
        if ($action) {
            $q->where('action', 'like', '%'.$action.'%');
        }
        if ($entityType) {
            $q->where('entity_type', $entityType);
        }
        if ($entityId !== null && $entityId !== '') {
            $q->where('entity_id', $entityId);
        }
        if ($from) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('created_at', '<=', $to);
        }

        $paginator = $q->paginate($perPage);
        $this->attachContext($paginator->getCollection());

        return ApiResponse::success($paginator, 'Audit logs retrieved successfully.');
    }

    public function show(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('audit_logs.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $row = AuditLog::query()->with(['user'])->findOrFail($id);
        $this->attachContext(collect([$row]));

        return ApiResponse::success($row, 'Audit log retrieved successfully.');
    }

    /**
     * Enrich Message-scoped rows with the WhatsApp customer name / phone
     * (derived from old_values.conversation_id) so Historique d'activité
     * shows "Message · Oussama OUSSAMA · n° 53" instead of just the id.
     * Runs once per page — no N+1.
     */
    private function attachContext(Collection $rows): void
    {
        $conversationIds = $rows
            ->filter(fn ($r) => $r->entity_type === \App\Models\Message::class)
            ->map(fn ($r) => (int) (($r->old_values['conversation_id'] ?? null) ?: ($r->new_values['conversation_id'] ?? null)))
            ->filter()
            ->unique()
            ->values();

        if ($conversationIds->isEmpty()) return;

        $customers = Conversation::query()
            ->whereIn('id', $conversationIds)
            ->with('customer:id,full_name,phone')
            ->get(['id', 'customer_id'])
            ->keyBy('id');

        foreach ($rows as $r) {
            if ($r->entity_type !== \App\Models\Message::class) continue;
            $cid = (int) (($r->old_values['conversation_id'] ?? null) ?: ($r->new_values['conversation_id'] ?? null));
            if (! $cid) continue;
            $conv = $customers->get($cid);
            $customer = $conv?->customer;
            if (! $customer) continue;
            $r->setAttribute('context', [
                'customer_id' => $customer->id,
                'customer_name' => $customer->full_name,
                'customer_phone' => $customer->phone,
                'conversation_id' => $cid,
            ]);
        }
    }

    public function lookups(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('audit_logs.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        return ApiResponse::success([
            'users' => User::select('id', 'name')->orderBy('name')->get(),
            'brands' => Brand::select('id', 'name')->orderBy('name')->get(),
            'customers' => Customer::selectRaw('id, full_name as name')->orderBy('full_name')->get(),
            'suppliers' => Supplier::select('id', 'name')->orderBy('name')->get(),
        ]);
    }
}
