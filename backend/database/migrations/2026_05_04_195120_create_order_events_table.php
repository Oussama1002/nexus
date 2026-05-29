<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event_type', 100);
            $table->enum('from_status', ['draft', 'pending', 'confirmed', 'cancelled', 'returned', 'delivered', 'other'])->nullable();
            $table->enum('to_status', ['draft', 'pending', 'confirmed', 'cancelled', 'returned', 'delivered', 'other'])->nullable();
            $table->text('note')->nullable();
            $table->timestamp('event_at')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_events');
    }
};
