<?php

namespace App\Console\Commands;

use App\Services\ClientInvoiceService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class GenerateMonthlyInvoicesCommand extends Command
{
    protected $signature = 'finance:generate-monthly-invoices {--month=} {--brand_id=}';

    protected $description = 'Generate draft monthly invoices from delivered orders.';

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

        $res = $this->invoiceService->generateMonthlyDrafts($start, $start->copy()->endOfMonth(), $brandId, null);
        $this->info("Generation terminee pour {$month}. Creees={$res['created']} / Ignorees={$res['skipped']}");

        return self::SUCCESS;
    }
}
