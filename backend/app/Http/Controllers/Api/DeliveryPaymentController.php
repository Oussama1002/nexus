<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreDeliveryPaymentRequest;
use App\Http\Requests\Api\UpdateDeliveryPaymentRequest;
use App\Models\DeliveryPayment;
use App\Models\Shipment;
use App\Services\AuditLogger;
use App\Services\DeliveryPaymentService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DeliveryPaymentController extends Controller
{
    public function __construct(
        protected DeliveryPaymentService $deliveryPaymentService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $state = $request->query('state');
        $deliveryCompanyId = $request->query('delivery_company_id');

        $q = DeliveryPayment::query()
            ->with(['deliveryCompany', 'shipments']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q
            ->orderByDesc('id');
        if ($state) {
            $q->where('state', $state);
        }
        if ($deliveryCompanyId) {
            $q->where('delivery_company_id', (int) $deliveryCompanyId);
        }

        return ApiResponse::success($q->paginate($perPage), 'Delivery payments retrieved successfully.');
    }

    public function codPendingSummary(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $deliveryCompanyId = $request->query('delivery_company_id');

        $q = Shipment::query()
            ->when($brandId, fn ($qq) => $qq->where('brand_id', $brandId))
            ->where('status', 'delivered')
            ->where('payment_status', 'cod_pending')
            ->whereNull('delivery_payment_id')
            ->whereHas('order', function ($o) {
                $o->where('payment_method', 'cod')->where('payment_state', 'cod_pending');
            });

        if ($deliveryCompanyId) {
            $q->where('delivery_company_id', (int) $deliveryCompanyId);
        }

        $rows = (clone $q)->with('order')->get();
        $total = round($rows->sum(fn (Shipment $s) => (float) ($s->cod_amount ?? $s->order?->total ?? 0)), 2);

        return ApiResponse::success([
            'total_cod_pending' => $total,
            'shipments' => $rows,
        ], 'COD pending data retrieved successfully.');
    }

    public function store(StoreDeliveryPaymentRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();

        $payment = DB::transaction(function () use ($request, $brandId, $data) {
            $p = DeliveryPayment::query()->create([
                'delivery_company_id' => $data['delivery_company_id'],
                'brand_id' => $brandId,
                'label' => $data['label'],
                'amount' => 0,
                'state' => $data['state'] ?? 'draft',
                'period_start' => $data['period_start'] ?? null,
                'period_end' => $data['period_end'] ?? null,
                'payment_date' => $data['payment_date'] ?? null,
                'note' => $data['note'] ?? null,
            ]);

            if (! empty($data['shipment_ids'])) {
                $this->deliveryPaymentService->attachShipments($p, $data['shipment_ids'], $request->user());
            }

            return $p->fresh(['shipments', 'deliveryCompany']);
        });

        AuditLogger::log($request, 'delivery_payments.create', $payment, null, $payment->toArray());

        return ApiResponse::success($payment, 'Delivery payment created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $p = DeliveryPayment::query()
            ->with(['deliveryCompany', 'shipments.order'])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($p, 'Delivery payment retrieved successfully.');
    }

    public function update(UpdateDeliveryPaymentRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $payment = DeliveryPayment::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $payment->toArray();
        $data = $request->validated();

        if ($payment->state === 'reconciled' && ! $request->user()->isAdmin()) {
            return ApiResponse::error('Reconciled settlements cannot be updated.', null, 422);
        }

        $payment->fill($data);
        $payment->save();

        if (isset($data['state']) && $data['state'] === 'received') {
            $payment->shipments()
                ->where('payment_status', 'cod_pending')
                ->update(['payment_status' => 'cod_received']);
        }

        if (isset($data['state']) && in_array($data['state'], ['received', 'disputed'], true)) {
            AuditLogger::log($request, 'delivery_payments.state', $payment, $before, $payment->fresh()->toArray());
        } else {
            AuditLogger::log($request, 'delivery_payments.update', $payment, $before, $payment->fresh()->toArray());
        }

        return ApiResponse::success($payment->fresh(['shipments', 'deliveryCompany']), 'Delivery payment updated successfully.');
    }

    public function reconcile(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $payment = DeliveryPayment::query()->where('brand_id', $brandId)->findOrFail($id);

        try {
            $after = $this->deliveryPaymentService->markReconciled($payment, $request->user());
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'delivery_payments.reconcile', $after, null, $after->toArray());

        return ApiResponse::success($after->load('shipments'), 'Settlement reconciled.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $payment = DeliveryPayment::query()->where('brand_id', $brandId)->findOrFail($id);

        if (in_array($payment->state, ['reconciled', 'received'], true)) {
            return ApiResponse::error('Only draft or disputed payments can be deleted.', null, 422);
        }

        $before = $payment->toArray();
        $payment->shipments()->detach();
        Shipment::query()->where('delivery_payment_id', $payment->id)->update(['delivery_payment_id' => null]);
        $payment->delete();

        AuditLogger::log($request, 'delivery_payments.delete', null, $before, null);

        return ApiResponse::success(null, 'Delivery payment deleted successfully.');
    }
}
