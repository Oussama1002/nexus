<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── Treasury accounts (bank / cash) ───
        if (!Schema::hasTable('treasury_accounts')) {
            Schema::create('treasury_accounts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('name');
                $table->string('kind', 30)->default('bank'); // bank|cash|virtual
                $table->decimal('initial_balance', 14, 2)->default(0);
                $table->string('currency', 10)->default('MAD');
                $table->boolean('is_active')->default(true);
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'is_active'], 'trx_acc_brand_active_idx');
            });
        }

        // ─── Treasury transactions ───
        if (!Schema::hasTable('treasury_transactions')) {
            Schema::create('treasury_transactions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('account_id')->constrained('treasury_accounts')->cascadeOnDelete();
                $table->date('date');
                $table->string('label');
                $table->string('type', 20); // income|expense
                $table->string('category', 60)->nullable();
                $table->decimal('amount', 14, 2);
                $table->string('reference', 100)->nullable();
                $table->text('notes')->nullable();
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['brand_id', 'date'], 'trx_brand_date_idx');
                $table->index(['account_id', 'date'], 'trx_acc_date_idx');
            });
        }

        // ─── Budgets ───
        if (!Schema::hasTable('budgets')) {
            Schema::create('budgets', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('name');
                $table->string('department', 60);
                $table->string('period_label', 40)->nullable(); // "2026-Q3", "Août 2026"
                $table->date('period_start');
                $table->date('period_end');
                $table->decimal('allocated', 14, 2);
                $table->string('status', 20)->default('active'); // active|closed|exceeded
                $table->text('notes')->nullable();
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'bud_brand_status_idx');
            });
        }

        // ─── Budget requests ───
        if (!Schema::hasTable('budget_requests')) {
            Schema::create('budget_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('budget_id')->nullable()->constrained('budgets')->nullOnDelete();
                $table->foreignId('requester_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->decimal('amount', 14, 2);
                $table->text('reason');
                $table->string('priority', 20)->default('medium'); // high|medium|low
                $table->string('status', 20)->default('pending'); // pending|approved|rejected|partial
                $table->decimal('approved_amount', 14, 2)->nullable();
                $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('decided_at')->nullable();
                $table->text('decision_note')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'br_brand_status_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_requests');
        Schema::dropIfExists('budgets');
        Schema::dropIfExists('treasury_transactions');
        Schema::dropIfExists('treasury_accounts');
    }
};
