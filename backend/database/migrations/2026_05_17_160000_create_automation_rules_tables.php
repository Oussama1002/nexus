<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name', 255);
            $table->string('trigger_key', 80);
            $table->text('description')->nullable();
            $table->json('condition_json')->nullable();
            $table->json('action_json');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['brand_id', 'trigger_key', 'is_active'], 'automation_rules_brand_trigger_active_idx');
        });

        Schema::create('automation_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('automation_rule_id')->constrained('automation_rules')->cascadeOnDelete();
            $table->string('trigger_key', 80);
            $table->json('event_payload_json');
            $table->json('context_payload_json')->nullable();
            $table->json('result_payload_json')->nullable();
            $table->enum('status', ['executed', 'skipped', 'failed'])->default('executed');
            $table->string('result_message', 1000)->nullable();
            $table->timestamps();

            $table->index(['brand_id', 'trigger_key', 'created_at'], 'automation_runs_brand_trigger_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_runs');
        Schema::dropIfExists('automation_rules');
    }
};
