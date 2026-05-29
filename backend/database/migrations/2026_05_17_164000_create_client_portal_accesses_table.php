<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_portal_accesses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->json('enabled_widgets')->nullable();
            $table->timestamps();

            $table->unique(['brand_id', 'user_id'], 'client_portal_brand_user_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_portal_accesses');
    }
};
