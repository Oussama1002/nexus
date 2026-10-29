<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customers') && ! Schema::hasColumn('customers', 'whatsapp_phone')) {
            Schema::table('customers', function (Blueprint $table) {
                // Numéro WhatsApp séparé du numéro d'appel (spec §6.1).
                // Vide = on utilise le numéro d'appel (phone).
                $table->string('whatsapp_phone', 30)->nullable()->after('phone_secondary');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('customers') && Schema::hasColumn('customers', 'whatsapp_phone')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->dropColumn('whatsapp_phone');
            });
        }
    }
};
