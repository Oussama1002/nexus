<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Leads still "new" whose customer already has a carrier parcel (matched by
// order or by phone) — e.g. WhatsApp leads later found in Ameex/Sendit.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('leads') || ! Schema::hasTable('customers') || ! Schema::hasTable('shipments')) {
            return;
        }

        $ids = DB::table('leads')
            ->join('customers', 'customers.id', '=', 'leads.customer_id')
            ->where('leads.status', 'new')
            ->where(function ($q) {
                $q->whereExists(fn ($s) => $s->selectRaw('1')->from('shipments')
                    ->join('orders', 'orders.id', '=', 'shipments.order_id')
                    ->whereColumn('orders.customer_id', 'customers.id'))
                    ->orWhereExists(fn ($s) => $s->selectRaw('1')->from('shipments')
                        ->whereColumn('shipments.brand_id', 'customers.brand_id')
                        ->where('customers.phone', '!=', '')
                        ->where(fn ($w) => $w->whereColumn('shipments.recipient_phone', 'customers.phone')
                            ->orWhereColumn('shipments.recipient_phone', 'customers.phone_secondary')));
            })
            ->pluck('leads.id');

        foreach ($ids->chunk(500) as $chunk) {
            DB::table('leads')->whereIn('id', $chunk)->update(['status' => 'confirmed', 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        // Non-destructive.
    }
};
