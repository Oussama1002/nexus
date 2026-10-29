<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_follow_ups')) {
            return;
        }

        // Suivis de fidélisation client (spec §6.6) : rappels post-livraison
        // avec résultat, opportunité d'upsell et montant de vente additionnelle.
        Schema::create('customer_follow_ups', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('brand_id')->nullable()->index();
            $table->unsignedBigInteger('customer_id')->nullable()->index();
            $table->unsignedBigInteger('order_id')->nullable()->index();
            $table->unsignedBigInteger('assigned_user_id')->nullable()->index();
            $table->unsignedInteger('sequence')->default(1);
            $table->date('due_at')->nullable()->index();
            // pending | done | skipped
            $table->string('status', 20)->default('pending')->index();
            // satisfait | insatisfait | pas_de_reponse | a_rappeler | autre
            $table->string('result', 30)->nullable();
            // aucune | autre_produit | offre_envoyee | nouvelle_commande
            $table->string('opportunity', 30)->nullable();
            $table->decimal('upsell_amount', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_follow_ups');
    }
};
