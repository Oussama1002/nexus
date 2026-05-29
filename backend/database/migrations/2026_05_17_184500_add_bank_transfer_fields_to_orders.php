<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'bank_transfer_declared_paid')) {
                $table->boolean('bank_transfer_declared_paid')->default(false)->after('payment_state');
            }
            if (! Schema::hasColumn('orders', 'bank_transfer_reference')) {
                $table->string('bank_transfer_reference', 120)->nullable()->after('bank_transfer_declared_paid');
            }
            if (! Schema::hasColumn('orders', 'bank_transfer_declared_at')) {
                $table->timestamp('bank_transfer_declared_at')->nullable()->after('bank_transfer_reference');
            }
            if (! Schema::hasColumn('orders', 'bank_transfer_verified_at')) {
                $table->timestamp('bank_transfer_verified_at')->nullable()->after('bank_transfer_declared_at');
            }
            if (! Schema::hasColumn('orders', 'bank_transfer_verification_status')) {
                $table->string('bank_transfer_verification_status', 24)->default('not_required')->after('bank_transfer_verified_at');
            }
            if (! Schema::hasColumn('orders', 'bank_transfer_verification_note')) {
                $table->string('bank_transfer_verification_note', 255)->nullable()->after('bank_transfer_verification_status');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'bank_transfer_verification_note')) {
                $table->dropColumn('bank_transfer_verification_note');
            }
            if (Schema::hasColumn('orders', 'bank_transfer_verification_status')) {
                $table->dropColumn('bank_transfer_verification_status');
            }
            if (Schema::hasColumn('orders', 'bank_transfer_verified_at')) {
                $table->dropColumn('bank_transfer_verified_at');
            }
            if (Schema::hasColumn('orders', 'bank_transfer_declared_at')) {
                $table->dropColumn('bank_transfer_declared_at');
            }
            if (Schema::hasColumn('orders', 'bank_transfer_reference')) {
                $table->dropColumn('bank_transfer_reference');
            }
            if (Schema::hasColumn('orders', 'bank_transfer_declared_paid')) {
                $table->dropColumn('bank_transfer_declared_paid');
            }
        });
    }
};
