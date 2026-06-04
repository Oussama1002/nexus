<?php

namespace App\Services;

use App\Models\ClientInvoice;
use App\Models\Customer;
use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use RuntimeException;

class ClientInvoiceService
{
    /**
     * Create a draft client invoice when a new order is recorded (one invoice per order).
     */
    public function createFromOrder(Order $order, ?int $actorUserId = null): ?ClientInvoice
    {
        $order->loadMissing(['customer', 'lines']);

        if (ClientInvoice::query()->where('order_id', $order->id)->exists()) {
            return ClientInvoice::query()->where('order_id', $order->id)->first();
        }

        $customerId = $order->customer_id;
        if (! $customerId && $order->lead_id) {
            $customerId = \App\Models\Lead::query()->whereKey($order->lead_id)->value('customer_id');
        }

        if (! $customerId) {
            return null;
        }

        $issueDate = $order->created_at?->toDateString() ?? now()->toDateString();
        $subtotal = round((float) $order->subtotal, 2);
        $discount = round((float) $order->discount, 2);
        $shipping = round((float) $order->shipping_fee, 2);
        $tax = 0.0;
        $total = round((float) $order->total, 2);
        if ($total <= 0) {
            $total = round($subtotal - $discount + $shipping + $tax, 2);
        }

        $lineSummary = $order->lines
            ->map(fn ($l) => sprintf('%s × %d', $l->product_name, $l->quantity))
            ->take(8)
            ->implode(', ');

        return ClientInvoice::query()->create([
            'brand_id' => $order->brand_id,
            'customer_id' => $customerId,
            'order_id' => $order->id,
            'created_by' => $actorUserId,
            'invoice_number' => $this->generateInvoiceNumber(),
            'billing_period_start' => $issueDate,
            'billing_period_end' => $issueDate,
            'issue_date' => $issueDate,
            'due_date' => now()->parse($issueDate)->addDays(15)->toDateString(),
            'currency' => 'MAD',
            'subtotal' => $subtotal + $shipping,
            'discount' => $discount,
            'tax_amount' => $tax,
            'total' => $total,
            'status' => 'draft',
            'recipient_email' => $order->customer?->email,
            'notes' => 'Facture générée automatiquement pour la commande '.$order->order_number.'.',
            'meta' => [
                'generated_automatically' => true,
                'source' => 'order_created',
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'order_lines_summary' => $lineSummary,
            ],
        ]);
    }

    public function generateInvoiceNumber(): string
    {
        for ($i = 0; $i < 20; $i++) {
            $candidate = 'FAC-'.now()->format('Ym').'-'.str_pad((string) random_int(1, 99999), 5, '0', STR_PAD_LEFT);
            if (! ClientInvoice::query()->where('invoice_number', $candidate)->exists()) {
                return $candidate;
            }
        }

        throw new RuntimeException('Unable to generate unique invoice number.');
    }

    /**
     * @return array{created:int, skipped:int}
     */
    public function generateMonthlyDrafts(Carbon $periodStart, Carbon $periodEnd, ?int $brandId = null, ?int $actorUserId = null): array
    {
        $created = 0;
        $skipped = 0;

        $orders = Order::query()
            ->where('status', 'delivered')
            ->whereNotNull('customer_id')
            ->whereBetween(DB::raw('DATE(COALESCE(delivered_at, created_at))'), [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->selectRaw('brand_id, customer_id, SUM(total) as total_amount')
            ->groupBy('brand_id', 'customer_id')
            ->get();

        foreach ($orders as $row) {
            $already = ClientInvoice::query()
                ->where('brand_id', $row->brand_id)
                ->where('customer_id', $row->customer_id)
                ->whereDate('billing_period_start', $periodStart->toDateString())
                ->whereDate('billing_period_end', $periodEnd->toDateString())
                ->whereNotIn('status', ['cancelled'])
                ->exists();

            if ($already) {
                $skipped++;
                continue;
            }

            /** @var Customer|null $customer */
            $customer = Customer::query()->find($row->customer_id);
            $recipientEmail = $customer?->email;

            $subtotal = round((float) $row->total_amount, 2);
            $discount = 0.0;
            $tax = 0.0;
            $total = round($subtotal - $discount + $tax, 2);

            ClientInvoice::query()->create([
                'brand_id' => $row->brand_id,
                'customer_id' => $row->customer_id,
                'created_by' => $actorUserId,
                'invoice_number' => $this->generateInvoiceNumber(),
                'billing_period_start' => $periodStart->toDateString(),
                'billing_period_end' => $periodEnd->toDateString(),
                'issue_date' => now()->toDateString(),
                'due_date' => now()->addDays(15)->toDateString(),
                'currency' => 'MAD',
                'subtotal' => $subtotal,
                'discount' => $discount,
                'tax_amount' => $tax,
                'total' => $total,
                'status' => 'draft',
                'recipient_email' => $recipientEmail,
                'notes' => null,
                'meta' => [
                    'generated_automatically' => true,
                    'source' => 'delivered_orders',
                ],
            ]);
            $created++;
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    /**
     * Generate invoice PDF content (bytes).
     */
    public function generatePdf(ClientInvoice $invoice): string
    {
        $invoice->loadMissing(['customer', 'brand', 'order']);

        $data = [
            'invoice' => $invoice,
            'brandName' => $invoice->brand?->name ?? 'Nexus',
            'customerName' => $invoice->customer?->full_name ?? '—',
            'customerEmail' => $invoice->recipient_email ?: $invoice->customer?->email,
            'currency' => $invoice->currency ?? 'MAD',
        ];

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.invoice', $data)
            ->setPaper('a4')
            ->setOption('defaultFont', 'Helvetica');

        return $pdf->output();
    }

    /**
     * @throws RuntimeException
     */
    public function sendInvoiceEmail(ClientInvoice $invoice): void
    {
        $invoice->loadMissing(['customer', 'brand', 'order']);

        $to = trim((string) ($invoice->recipient_email ?: $invoice->customer?->email));
        if ($to === '') {
            throw new RuntimeException('Invoice has no recipient email.');
        }

        $subject = sprintf('Facture %s (%s → %s)', $invoice->invoice_number, $invoice->billing_period_start?->toDateString(), $invoice->billing_period_end?->toDateString());
        $body = implode("\n", [
            'Bonjour,',
            '',
            'Veuillez trouver ci-joint votre facture.',
            '',
            'Numero: '.$invoice->invoice_number,
            'Periode: '.$invoice->billing_period_start?->toDateString().' au '.$invoice->billing_period_end?->toDateString(),
            'Montant total: '.number_format((float) $invoice->total, 2, ',', ' ').' '.($invoice->currency ?? 'MAD'),
            '',
            'Merci de votre confiance.',
        ]);

        $pdfContent = $this->generatePdf($invoice);
        $filename = 'Facture-'.$invoice->invoice_number.'.pdf';

        try {
            Mail::raw($body, function ($message) use ($to, $subject, $pdfContent, $filename): void {
                $message->to($to)
                    ->subject($subject)
                    ->attachData($pdfContent, $filename, ['mime' => 'application/pdf']);
            });
        } catch (\Throwable $e) {
            Log::error('invoice.send.failed', [
                'invoice_id' => $invoice->id,
                'email' => $to,
                'error' => $e->getMessage(),
            ]);
            throw new RuntimeException('Failed to send invoice email: '.$e->getMessage());
        }
    }
}
