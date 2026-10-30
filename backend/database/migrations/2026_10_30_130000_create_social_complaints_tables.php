<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Réclamations réseaux sociaux suivies par le Community Manager
        // (spec Droits CM §3).
        if (! Schema::hasTable('social_complaints')) {
            Schema::create('social_complaints', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('brand_id')->index();
                $table->string('platform', 40)->nullable();          // instagram, facebook, tiktok…
                $table->string('channel', 20)->nullable();           // dm | comment
                $table->string('customer_name', 191)->nullable();    // nom ou pseudo
                $table->text('customer_link')->nullable();           // lien message/commentaire
                $table->timestamp('received_at')->nullable();
                $table->string('reason', 40)->nullable();            // retard | defectueux | remboursement | service | autre
                $table->text('description')->nullable();
                $table->text('screenshot_url')->nullable();
                $table->string('status', 20)->default('nouvelle');   // nouvelle|en_cours|transmise|resolue|cloturee
                $table->string('assigned_to_text', 191)->nullable(); // transmise à (service/personne)
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
            });
        }

        // Historique de suivi (actions/réponses datées).
        if (! Schema::hasTable('social_complaint_updates')) {
            Schema::create('social_complaint_updates', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('social_complaint_id')->index();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->text('note');
                $table->string('status_after', 20)->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('social_complaint_updates');
        Schema::dropIfExists('social_complaints');
    }
};
