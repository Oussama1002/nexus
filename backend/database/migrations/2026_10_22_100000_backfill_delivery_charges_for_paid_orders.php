<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders') || ! Schema::hasTable('charges')) {
            return;
        }

        // Les commandes payees (COD livre via synchro transporteur, virement verifie...)
        // n'avaient pas de charge de livraison car celle-ci n'etait creee que dans le
        // controleur. On rattrape l'historique pour que l'ecran Depenses reflete le reel.
        DB::table('orders')
            ->where('payment_state', 'paid')
            ->where('shipping_fee', '>', 0)
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('charges')
                    ->whereColumn('charges.order_id', 'orders.id')
                    ->where('charges.type', 'delivery');
            })
            ->orderBy('id')
            ->chunkById(500, function ($orders) {
                $now = now();
                $rows = [];
                foreach ($orders as $o) {
                    $date = $o->delivered_at ?? $o->updated_at ?? $o->created_at;
                    $rows[] = [
                        'brand_id' => $o->brand_id,
                        'order_id' => $o->id,
                        'created_by' => null,
                        'charge_date' => $date ? \Illuminate\Support\Carbon::parse($date)->toDateString() : $now->toDateString(),
                        'type' => 'delivery',
                        'amount' => $o->shipping_fee,
                        'note' => 'Frais de livraison – Commande '.$o->order_number,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
                if ($rows) {
                    DB::table('charges')->insert($rows);
                }
            });
    }

    public function down(): void
    {
        // Non reversible : on ne peut pas distinguer les charges rattrapees des charges
        // creees normalement. Laisse les donnees en place.
    }
};
