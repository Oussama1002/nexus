<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('supplier_code', 64)->nullable();
            $table->string('supplier_type', 32)->default('product');
            $table->string('phone_secondary', 40)->nullable();
            $table->string('whatsapp', 40)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 120)->nullable();
            $table->string('country', 120)->nullable();
            $table->text('products_supplied')->nullable();
            $table->decimal('min_order_amount', 15, 2)->nullable();
            $table->string('currency', 8)->nullable();
            $table->text('payment_terms')->nullable();
            $table->string('preferred_payment_mode', 120)->nullable();
            $table->decimal('quality_score', 4, 2)->nullable();
            $table->boolean('frequent_delays')->default(false);
            $table->text('complaints_notes')->nullable();
            $table->string('ice', 80)->nullable();
            $table->string('if_number', 80)->nullable();
            $table->string('rc_number', 80)->nullable();
            $table->string('patente', 120)->nullable();
            $table->text('rib_iban')->nullable();
            $table->string('contract_reference', 255)->nullable();
            $table->string('price_list_reference', 255)->nullable();
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE suppliers MODIFY COLUMN status ENUM('active','inactive','blacklisted') NOT NULL DEFAULT 'active'");
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE suppliers MODIFY COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active'");
        }

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn([
                'supplier_code',
                'supplier_type',
                'phone_secondary',
                'whatsapp',
                'address',
                'city',
                'country',
                'products_supplied',
                'min_order_amount',
                'currency',
                'payment_terms',
                'preferred_payment_mode',
                'quality_score',
                'frequent_delays',
                'complaints_notes',
                'ice',
                'if_number',
                'rc_number',
                'patente',
                'rib_iban',
                'contract_reference',
                'price_list_reference',
            ]);
        });
    }
};
