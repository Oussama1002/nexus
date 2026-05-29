<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cm_daily_tracking', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cm_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->date('work_date');
            $table->text('tasks')->nullable();
            $table->text('completed_actions')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['cm_user_id', 'brand_id', 'work_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cm_daily_tracking');
    }
};
