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
     * @throws RuntimeException
     */
    public function sendInvoiceEmail(ClientInvoice $invoice): void
    {
        $invoice->loadMissing(['customer', 'brand']);

        $to = trim((string) ($invoice->recipient_email ?: $invoice->customer?->email));
        if ($to === '') {
            throw new RuntimeException('Invoice has no recipient email.');
        }

        $subject = sprintf('Facture %s (%s → %s)', $invoice->invoice_number, $invoice->billing_period_start?->toDateString(), $invoice->billing_period_end?->toDateString());
        $body = implode("\n", [
            'Bonjour,',
            '',
            'Votre facture mensuelle est prete.',
            'Numero: '.$invoice->invoice_number,
            'Periode: '.$invoice->billing_period_start?->toDateString().' au '.$invoice->billing_period_end?->toDateString(),
            'Montant total: '.number_format((float) $invoice->total, 2, '.', ' ').' '.$invoice->currency,
            '',
            'Merci de votre confiance.',
        ]);

        try {
            Mail::raw($body, function ($message) use ($to, $subject): void {
                $message->to($to)->subject($subject);
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
