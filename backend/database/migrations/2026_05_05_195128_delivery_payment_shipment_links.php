<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (! Schema::hasColumn('shipments', 'delivery_payment_id')) {
                $table->foreignId('delivery_payment_id')->nullable()->after('delivery_company_id')->constrained('delivery_payments')->nullOnDelete();
            }
        });

        Schema::create('delivery_payment_shipment', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_payment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $table->decimal('cod_amount', 12, 2)->default(0);
            $table->timestamps();

            $table->unique(['delivery_payment_id', 'shipment_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_payment_shipment');

        Schema::table('shipments', function (Blueprint $table) {
            if (Schema::hasColumn('shipments', 'delivery_payment_id')) {
                $table->dropForeign(['delivery_payment_id']);
                $table->dropColumn('delivery_payment_id');
            }
        });
    }
};
