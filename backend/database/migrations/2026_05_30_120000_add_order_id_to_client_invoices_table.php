<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_invoices', function (Blueprint $table) {
            if (! Schema::hasColumn('client_invoices', 'order_id')) {
                $table->foreignId('order_id')->nullable()->after('customer_id')->constrained('orders')->nullOnDelete();
                $table->unique('order_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('client_invoices', function (Blueprint $table) {
            if (Schema::hasColumn('client_invoices', 'order_id')) {
                $table->dropForeign(['order_id']);
                $table->dropUnique(['order_id']);
                $table->dropColumn('order_id');
            }
        });
    }
};
