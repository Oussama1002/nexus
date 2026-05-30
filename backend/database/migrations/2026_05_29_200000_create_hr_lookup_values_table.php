<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_lookup_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('type', 32);
            $table->string('value');
            $table->timestamps();

            $table->unique(['brand_id', 'type', 'value']);
            $table->index(['type', 'brand_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_lookup_values');
    }
};
