<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Coordonnées de support d'un transporteur : sans elles, régler un litige
 * passait par un carnet d'adresses hors du CRM.
 */
return new class extends Migration
{
    private const COLUMNS = [
        'whatsapp' => 'phone',
        'support_email' => 'email',
        'support_url' => 'tracking_base_url',
        'website' => 'tracking_base_url',
        'address' => 'notes',
        'account_reference' => 'notes',
    ];

    public function up(): void
    {
        if (! Schema::hasTable('delivery_companies')) {
            return;
        }

        Schema::table('delivery_companies', function (Blueprint $table) {
            foreach (self::COLUMNS as $column => $after) {
                if (! Schema::hasColumn('delivery_companies', $column)) {
                    $table->string($column, 255)->nullable()->after($after);
                }
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('delivery_companies')) {
            return;
        }

        foreach (array_keys(self::COLUMNS) as $column) {
            if (Schema::hasColumn('delivery_companies', $column)) {
                Schema::table('delivery_companies', function (Blueprint $table) use ($column) {
                    $table->dropColumn($column);
                });
            }
        }
    }
};
