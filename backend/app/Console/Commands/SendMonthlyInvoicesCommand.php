<?php

namespace App\Console\Commands;

use App\Models\ClientInvoice;
use App\Services\ClientInvoiceService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SendMonthlyInvoicesCommand extends Command
{
    protected $signature = 'finance:send-monthly-invoices {--month=} {--brand_id=}';

    protected $description = 'Send approved monthly invoices to customers via email.';

    public function __construct(
        protected ClientInvoiceService $invoiceService
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $month = (string) ($this->option('month') ?: now()->subMonth()->format('Y-m'));
        $brandId = $this->option('brand_id') !== null ? (int) $this->option('brand_id') : null;

        try {
            $start = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        } catch (\Throwable) {
            $this->error('Invalid --month value. Use YYYY-MM.');

            return self::FAILURE;
        }
        $end = $start->copy()->endOfMonth();

        $query = ClientInvoice::query()
            ->where('status', 'approved')
            ->whereDate('billing_period_start', $start->toDateString())
            ->whereDate('billing_period_end', $end->toDateString())
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId));

        $sent = 0;
        $failed = 0;

        $query->orderBy('id')->chunkById(100, function ($invoices) use (&$sent, &$failed): void {
            foreach ($invoices as $invoice) {
                try {
                    $this->invoiceService->sendInvoiceEmail($invoice);
                    $invoice->status = 'sent';
                    $invoice->sent_at = now();
                    $invoice->email_last_error = null;
                    $invoice->save();
                    $sent++;
                } catch (\Throwable $e) {
                    $invoice->email_last_error = $e->getMessage();
                    $invoice->save();
                    $failed++;
                }
            }
        });

        $this->info("Envoi mensualise termine. Mois={$month} / envoyees={$sent} / echecs={$failed}");

        return self::SUCCESS;
    }
}
