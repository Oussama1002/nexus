<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_numbers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->string('phone_id')->unique(); // Meta phone_number_id (webhook routing key)
            $table->string('waba_id')->nullable();
            $table->string('display_number')->nullable();
            $table->string('verified_name')->nullable();
            $table->string('label')->nullable();
            $table->text('api_token')->nullable(); // per-number token; falls back to brand wa_api_token
            $table->string('api_base_url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['brand_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_numbers');
    }
};
