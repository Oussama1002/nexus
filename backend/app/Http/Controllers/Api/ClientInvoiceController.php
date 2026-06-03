<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreClientInvoiceRequest;
use App\Http\Requests\Api\UpdateClientInvoiceRequest;
use App\Models\ClientInvoice;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\AuditService;
use App\Services\ClientInvoiceService;
use App\Services\WhatsAppCloudService;
use App\Support\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ClientInvoiceController extends Controller
{
    public function __construct(
        protected ClientInvoiceService $invoiceService,
        protected WhatsAppCloudService $whatsApp,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.view');
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $brandId = $request->query('brand_id');
        $status = $request->query('status');
        $customerId = $request->query('customer_id');
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $search = $request->query('search');

        $q = ClientInvoice::query()
            ->with(['brand', 'customer', 'contract', 'creator', 'approver', 'order:id,order_number'])
            ->orderByDesc('id');

        if ($brandId !== null && $brandId !== '') {
            $q->where('brand_id', (int) $brandId);
        }
        if ($status) {
            $q->where('status', (string) $status);
        }
        if ($customerId !== null && $customerId !== '') {
            $q->where('customer_id', (int) $customerId);
        }
        if ($from) {
            $q->whereDate('issue_date', '>=', (string) $from);
        }
        if ($to) {
            $q->whereDate('issue_date', '<=', (string) $to);
        }
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($qq) use ($s): void {
                $qq->where('invoice_number', 'like', $s)
                    ->orWhereHas('customer', fn ($cq) => $cq->where('full_name', 'like', $s)->orWhere('email', 'like', $s));
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Client invoices retrieved successfully.');
    }

    public function store(StoreClientInvoiceRequest $request): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.create');
        $data = $request->validated();
        $data['created_by'] = $request->user()?->id;
        $data['invoice_number'] = $this->invoiceService->generateInvoiceNumber();
        $data['discount'] = (float) ($data['discount'] ?? 0);
        $data['tax_amount'] = (float) ($data['tax_amount'] ?? 0);
        $data['total'] = round((float) $data['subtotal'] - (float) $data['discount'] + (float) $data['tax_amount'], 2);

        $row = ClientInvoice::query()->create($data);
        AuditService::log($request, 'client_invoices.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['brand', 'customer', 'contract']), 'Client invoice created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.view');
        $row = ClientInvoice::query()->with(['brand', 'customer', 'contract', 'creator', 'approver'])->findOrFail($id);

        return ApiResponse::success($row, 'Client invoice retrieved successfully.');
    }

    public function update(UpdateClientInvoiceRequest $request, string $id): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.update');
        $row = ClientInvoice::query()->findOrFail($id);
        $before = $row->toArray();

        if (in_array($row->status, ['sent', 'paid'], true)) {
            return ApiResponse::error('Sent or paid invoice cannot be edited.', null, 422);
        }

        $data = $request->validated();
        $row->fill($data);
        $subtotal = array_key_exists('subtotal', $data) ? (float) $data['subtotal'] : (float) $row->subtotal;
        $discount = array_key_exists('discount', $data) ? (float) ($data['discount'] ?? 0) : (float) $row->discount;
        $tax = array_key_exists('tax_amount', $data) ? (float) ($data['tax_amount'] ?? 0) : (float) $row->tax_amount;
        $row->total = round($subtotal - $discount + $tax, 2);
        $row->save();

        AuditService::log($request, 'client_invoices.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['brand', 'customer', 'contract']), 'Client invoice updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.delete');
        $row = ClientInvoice::query()->findOrFail($id);
        if (in_array($row->status, ['sent', 'paid'], true)) {
            return ApiResponse::error('Sent or paid invoice cannot be deleted.', null, 422);
        }
        $before = $row->toArray();
        $row->delete();

        AuditService::log($request, 'client_invoices.delete', null, $before, null);

        return ApiResponse::success(null, 'Client invoice deleted successfully.');
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.update');
        $row = ClientInvoice::query()->findOrFail($id);

        if ($row->status !== 'draft') {
            return ApiResponse::error('Only draft invoices can be approved.', null, 422);
        }

        $before = $row->toArray();
        $row->status = 'approved';
        $row->approval_user_id = $request->user()?->id;
        $row->approved_at = now();
        $row->save();

        AuditService::log($request, 'client_invoices.approve', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['customer', 'approver']), 'Invoice approved.');
    }

    public function send(Request $request, string $id): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.update');
        $row = ClientInvoice::query()->with(['customer'])->findOrFail($id);

        if ($row->status !== 'approved') {
            return ApiResponse::error('Only approved invoices can be sent.', null, 422);
        }

        try {
            $this->invoiceService->sendInvoiceEmail($row);
        } catch (\RuntimeException $e) {
            $row->email_last_error = $e->getMessage();
            $row->save();

            return ApiResponse::error($e->getMessage(), null, 422);
        }

        $before = $row->toArray();
        $row->status = 'sent';
        $row->sent_at = now();
        $row->email_last_error = null;
        $row->save();

        AuditService::log($request, 'client_invoices.send', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['customer']), 'Invoice sent successfully.');
    }

    public function generateMonthly(Request $request): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.create');
        $month = (string) ($request->input('month') ?: now()->subMonth()->format('Y-m'));
        $brandId = $request->input('brand_id') !== null ? (int) $request->input('brand_id') : null;

        try {
            $periodStart = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        } catch (\Throwable) {
            return ApiResponse::error('Invalid month format. Expected YYYY-MM.', null, 422);
        }
        $periodEnd = $periodStart->copy()->endOfMonth();

        $result = $this->invoiceService->generateMonthlyDrafts($periodStart, $periodEnd, $brandId, $request->user()?->id);

        return ApiResponse::success([
            'month' => $month,
            'created' => $result['created'],
            'skipped' => $result['skipped'],
        ], 'Monthly invoices generated.');
    }

    public function sendToWhatsApp(Request $request, int $id): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.view');

        $invoice = ClientInvoice::with('customer')->findOrFail($id);
        $customer = $invoice->customer;

        if (! $customer || ! $customer->phone) {
            return ApiResponse::error('Client sans numero de telephone.', null, 422);
        }

        $phone = ltrim($customer->phone, '+');
        $brandId = (int) $invoice->brand_id;

        // Build invoice message
        $msg = "Facture #{$invoice->invoice_number}\n"
            . "Client : {$customer->full_name}\n"
            . "Montant : {$invoice->total} {$invoice->currency}\n"
            . "Date : {$invoice->issue_date}\n"
            . "Echeance : {$invoice->due_date}\n"
            . "Statut : {$invoice->status}";

        // Find or create conversation
        $conversation = Conversation::query()
            ->where('brand_id', $brandId)
            ->where('channel', 'whatsapp')
            ->where('customer_id', $customer->id)
            ->first();

        if (! $conversation) {
            $conversation = Conversation::query()->create([
                'brand_id' => $brandId,
                'customer_id' => $customer->id,
                'channel' => 'whatsapp',
                'external_thread_id' => $phone,
                'status' => 'open',
            ]);
        }

        // Try to send via WhatsApp API
        try {
            $externalId = $this->whatsApp->sendText($brandId, $phone, $msg);
        } catch (\Throwable $e) {
            // Even if API fails, store the message locally
            $externalId = null;
        }

        // Store message in conversation
        Message::query()->create([
            'conversation_id' => $conversation->id,
            'sender_user_id' => $request->user()?->id,
            'direction' => 'outbound',
            'content' => $msg,
            'message_type' => 'text',
            'external_message_id' => $externalId,
            'sent_at' => now(),
        ]);

        $conversation->update(['last_message_at' => now()]);

        return ApiResponse::success(null, 'Facture envoyee dans la conversation WhatsApp.');
    }

    private function requireFinancePermission(Request $request, string $slug): void
    {
        if (! $request->user()?->hasPermissionSlug($slug)) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
