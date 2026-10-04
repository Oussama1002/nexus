<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Un paiement influenceur réglé est une dépense marketing, au même titre
 * qu'un achat média. Il n'était rattaché à aucune charge : les rapports
 * l'ignoraient complètement.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('charges') || ! Schema::hasTable('influencer_payments')) {
            return;
        }

        if (! Schema::hasColumn('charges', 'influencer_payment_id')) {
            Schema::table('charges', function (Blueprint $table) {
                $table->unsignedBigInteger('influencer_payment_id')->nullable()->after('campaign_id');
                $table->index('influencer_payment_id');
            });
        }

        // Rattrapage : les paiements deja payes n'ont jamais genere de charge.
        $paid = DB::table('influencer_payments')
            ->where('status', 'paye')
            ->whereNotIn('id', DB::table('charges')->whereNotNull('influencer_payment_id')->pluck('influencer_payment_id'))
            ->get();

        foreach ($paid as $payment) {
            DB::table('charges')->insert([
                'brand_id' => $payment->brand_id,
                'influencer_payment_id' => $payment->id,
                'created_by' => $payment->created_by,
                'charge_date' => $payment->paid_at ?: now()->toDateString(),
                'type' => 'influencer',
                'amount' => $payment->amount,
                'note' => 'Paiement influenceur '.($payment->reference ?? $payment->id),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('charges') || ! Schema::hasColumn('charges', 'influencer_payment_id')) {
            return;
        }

        DB::table('charges')->whereNotNull('influencer_payment_id')->delete();

        Schema::table('charges', function (Blueprint $table) {
            $table->dropColumn('influencer_payment_id');
        });
    }
};
