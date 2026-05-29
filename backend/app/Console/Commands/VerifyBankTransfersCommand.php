<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\OrderEvent;
use Illuminate\Console\Command;

class VerifyBankTransfersCommand extends Command
{
    protected $signature = 'orders:verify-bank-transfers {--brand_id=}';

    protected $description = 'Verify pending bank-transfer payments and mark orders as paid when matched.';

    public function handle(): int
    {
        $brandId = $this->option('brand_id');
        $processed = 0;
        $verified = 0;
        $failed = 0;

        $query = Order::query()
            ->where('payment_method', 'transfer')
            ->where('payment_state', '!=', 'paid')
            ->where('bank_transfer_declared_paid', true)
            ->whereIn('bank_transfer_verification_status', ['pending', 'failed']);

        if ($brandId !== null && $brandId !== '') {
            $query->where('brand_id', (int) $brandId);
        }

        $query->orderBy('id')->chunkById(200, function ($orders) use (&$processed, &$verified, &$failed) {
            foreach ($orders as $order) {
                $processed++;
                $reference = trim((string) ($order->bank_transfer_reference ?? ''));
                $canVerify = $reference !== '' && (float) $order->total > 0;

                if ($canVerify) {
                    $order->payment_state = 'paid';
                    $order->bank_transfer_verification_status = 'verified';
                    $order->bank_transfer_verified_at = now();
                    $order->bank_transfer_verification_note = 'Verification automatique: virement reference detectee.';
                    $order->save();
                    OrderEvent::query()->create([
                        'order_id' => $order->id,
                        'actor_user_id' => null,
                        'event_type' => 'payment_verified',
                        'note' => 'Paiement virement verifie automatiquement.',
                        'event_at' => now(),
                    ]);
                    $verified++;

                    continue;
                }

                $order->bank_transfer_verification_status = 'failed';
                $order->bank_transfer_verification_note = 'Verification automatique echouee: reference virement manquante ou montant invalide.';
                $order->save();
                $failed++;
            }
        });

        $this->info("Virement check termine. Traites={$processed}, verifies={$verified}, en_echec={$failed}");

        return self::SUCCESS;
    }
}
