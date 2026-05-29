<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('brand_knowledge_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('category', 32)->default('general');
            $table->string('title', 255);
            $table->text('content');
            $table->string('media_url', 2048)->nullable();
            $table->string('product_name', 255)->nullable();
            $table->json('tags')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['brand_id', 'category', 'is_active'], 'bki_brand_category_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brand_knowledge_items');
    }
};
