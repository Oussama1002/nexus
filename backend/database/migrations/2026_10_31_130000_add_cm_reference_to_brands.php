<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('brands')) {
            return;
        }

        // Fiche de référence Community Manager (spec Droits CM §6) : informations
        // utiles pour répondre aux clients, saisies par l'admin sur la marque et
        // consultées en lecture seule par le CM. Les données de vente/finance
        // restent hors de cette fiche.
        Schema::table('brands', function (Blueprint $table) {
            foreach ([
                'cm_presentation',
                'cm_tone_rules',
                'cm_canned_replies',
                'cm_faq',
                'cm_escalation_contacts',
            ] as $col) {
                if (! Schema::hasColumn('brands', $col)) {
                    $table->text($col)->nullable();
                }
            }
            // L'admin décide si la fiche est visible par le CM (spec §6).
            if (! Schema::hasColumn('brands', 'cm_reference_visible')) {
                $table->boolean('cm_reference_visible')->default(false);
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('brands')) {
            return;
        }

        Schema::table('brands', function (Blueprint $table) {
            foreach ([
                'cm_presentation', 'cm_tone_rules', 'cm_canned_replies',
                'cm_faq', 'cm_escalation_contacts', 'cm_reference_visible',
            ] as $col) {
                if (Schema::hasColumn('brands', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
