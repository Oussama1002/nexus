<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('follow_up_schedules')) {
            return;
        }

        // Calendrier de fidélisation (spec §6.6) : délais des rappels après
        // livraison, configurables par marque et par produit.
        Schema::create('follow_up_schedules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('brand_id')->index();
            // NULL = calendrier par défaut de la marque ; sinon override produit.
            $table->unsignedBigInteger('product_id')->nullable()->index();
            // Délais (jours après livraison), tableau croissant : [7,14,21,…].
            $table->json('offsets');
            // Après le dernier délai, on reprogramme tous les N jours (NULL = stop).
            $table->unsignedInteger('repeat_every_days')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->unique(['brand_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('follow_up_schedules');
    }
};
