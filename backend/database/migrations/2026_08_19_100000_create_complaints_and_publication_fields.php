<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Call Center Complaints ──
        Schema::create('complaints', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->string('reference')->unique();
            $table->string('customer_name');
            $table->string('customer_phone')->nullable();
            $table->string('customer_handle')->nullable();
            $table->string('channel');
            $table->string('category');
            $table->string('priority')->default('P2');
            $table->text('description');
            $table->string('status')->default('nouvelle');
            $table->unsignedBigInteger('source_user_id')->nullable();
            $table->string('source')->default('community_manager');
            $table->unsignedBigInteger('assigned_user_id')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->foreign('source_user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('assigned_user_id')->references('id')->on('users')->nullOnDelete();
        });

        // ── Complaint Thread Entries ──
        Schema::create('complaint_thread_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('complaint_id')->constrained('complaints')->cascadeOnDelete();
            $table->unsignedBigInteger('author_user_id');
            $table->string('entry_type')->default('message');
            $table->text('content');
            $table->json('attachments')->nullable();
            $table->timestamps();

            $table->foreign('author_user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        // ── Content Calendar: publication fields for CM ──
        Schema::table('content_calendar', function (Blueprint $table) {
            $table->string('published_url')->nullable()->after('published_at');
            $table->text('not_published_reason')->nullable()->after('published_url');
        });
    }

    public function down(): void
    {
        Schema::table('content_calendar', function (Blueprint $table) {
            $table->dropColumn(['published_url', 'not_published_reason']);
        });
        Schema::dropIfExists('complaint_thread_entries');
        Schema::dropIfExists('complaints');
    }
};
