<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->string('setting_key');
            $table->text('setting_value')->nullable();
            $table->string('value_type', 50)->default('string');
            $table->timestamps();

            $table->unique(['brand_id', 'setting_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
