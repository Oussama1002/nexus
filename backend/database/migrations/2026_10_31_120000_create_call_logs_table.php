<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('call_logs')) {
            return;
        }

        // Journalisation des appels (spec Confirmatrice §6.7) : chaque appel lancé
        // par une agente est enregistré ici pour alimenter les indicateurs
        // « appels effectués / personnes appelées / décrochés / joignabilité ».
        Schema::create('call_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('brand_id')->nullable()->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->unsignedBigInteger('customer_id')->nullable()->index();
            $table->unsignedBigInteger('order_id')->nullable()->index();
            $table->unsignedBigInteger('lead_id')->nullable()->index();
            $table->string('phone', 40)->nullable();
            // décroché = answered ; non décroché = no_answer | busy | invalid.
            $table->string('outcome', 20);
            $table->text('notes')->nullable();
            $table->timestamp('called_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('call_logs');
    }
};
