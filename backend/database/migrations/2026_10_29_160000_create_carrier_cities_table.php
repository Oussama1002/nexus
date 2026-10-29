<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('carrier_cities')) {
            // Villes desservies par chaque transporteur (spec §6.1), synchronisées
            // depuis les API transporteur (Ameex / Sendit).
            Schema::create('carrier_cities', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('delivery_company_id')->index();
                $table->string('name');
                // Nom normalisé (minuscules, sans accents) pour l'unicité/matching.
                $table->string('normalized_name')->index();
                // Identifiant de la ville chez le transporteur.
                $table->string('external_id')->nullable();
                $table->timestamps();

                $table->unique(['delivery_company_id', 'normalized_name']);
            });
        }

        // La commande mémorise le transporteur choisi à la création (spec §6.1).
        if (Schema::hasTable('orders') && ! Schema::hasColumn('orders', 'delivery_company_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->unsignedBigInteger('delivery_company_id')->nullable()->after('assigned_user_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'delivery_company_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('delivery_company_id');
            });
        }
        Schema::dropIfExists('carrier_cities');
    }
};
