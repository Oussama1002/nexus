<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounting_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code', 20)->index();
            $table->string('label');
            $table->enum('type', ['actif', 'passif', 'charge', 'produit']);
            $table->foreignId('parent_id')->nullable()->constrained('accounting_accounts')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['brand_id', 'code']);
        });

        Schema::create('accounting_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('account_id')->constrained('accounting_accounts')->cascadeOnDelete();
            $table->date('entry_date');
            $table->string('journal', 30)->default('OD');
            $table->string('reference', 100)->nullable();
            $table->string('label');
            $table->decimal('debit', 14, 2)->default(0);
            $table->decimal('credit', 14, 2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['brand_id', 'entry_date']);
            $table->index(['account_id', 'entry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_entries');
        Schema::dropIfExists('accounting_accounts');
    }
};
