<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── Returns ───
        if (!Schema::hasTable('returns_records')) {
            Schema::create('returns_records', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
                $table->string('order_ref', 100)->nullable();
                $table->string('customer_name');
                $table->string('product_name');
                $table->text('reason');
                $table->string('status', 20)->default('requested'); // requested|in_transit|received|refunded|refused
                $table->decimal('amount', 12, 2)->default(0);
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'ret_brand_status_idx');
            });
        }

        // ─── Delivery failures ───
        if (!Schema::hasTable('delivery_failures')) {
            Schema::create('delivery_failures', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
                $table->string('tracking_number', 100);
                $table->string('order_ref', 100)->nullable();
                $table->string('customer_name');
                $table->string('carrier', 60);
                $table->text('reason');
                $table->unsignedSmallInteger('attempts')->default(1);
                $table->string('status', 20)->default('pending'); // pending|rescheduled|cancelled
                $table->timestamp('failed_at');
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'delfail_brand_status_idx');
                $table->index('tracking_number', 'delfail_tracking_idx');
            });
        }

        // ─── Bugs & incidents ───
        if (!Schema::hasTable('bugs_incidents')) {
            Schema::create('bugs_incidents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('severity', 20)->default('minor'); // critical|major|minor|cosmetic
                $table->string('module', 30)->default('other'); // crm|orders|delivery|finance|hr|academy|other
                $table->foreignId('reporter_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('assignee_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status', 20)->default('open'); // open|in_progress|resolved|closed
                $table->text('resolution')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'status', 'severity'], 'bugs_brand_stat_sev_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bugs_incidents');
        Schema::dropIfExists('delivery_failures');
        Schema::dropIfExists('returns_records');
    }
};
