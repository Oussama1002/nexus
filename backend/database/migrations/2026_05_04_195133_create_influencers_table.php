<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('influencers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->string('full_name');
            $table->string('username')->nullable();
            $table->string('platform', 100)->nullable();
            $table->string('niche')->nullable();
            $table->unsignedBigInteger('audience_size')->nullable();
            $table->json('pricing_json')->nullable();
            $table->string('contact_phone', 30)->nullable();
            $table->string('contact_email')->nullable();
            $table->enum('status', ['lead', 'active', 'inactive', 'blacklisted'])->default('lead');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('influencers');
    }
};
