<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── Learning paths ───
        if (!Schema::hasTable('academy_learning_paths')) {
            Schema::create('academy_learning_paths', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('level', 20)->default('beginner'); // beginner|intermediate|advanced
                $table->decimal('duration_hours', 6, 1)->default(0);
                $table->string('status', 20)->default('draft'); // active|draft|archived
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'alp_brand_status_idx');
            });
        }

        // ─── Academy contents (library) ───
        if (!Schema::hasTable('academy_contents')) {
            Schema::create('academy_contents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('learning_path_id')->nullable()->constrained('academy_learning_paths')->nullOnDelete();
                $table->string('title');
                $table->string('type', 20)->default('article'); // video|article|quiz|document|exercise
                $table->text('description')->nullable();
                $table->string('media_url', 500)->nullable();
                $table->unsignedInteger('duration_minutes')->nullable();
                $table->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->unsignedInteger('views_count')->default(0);
                $table->decimal('rating', 3, 2)->nullable();
                $table->string('status', 20)->default('draft'); // published|draft|archived
                $table->timestamps();
                $table->index(['brand_id', 'status', 'type'], 'ac_brand_stat_type_idx');
                $table->index('learning_path_id', 'ac_path_idx');
            });
        }

        // ─── Enrollments (users following a learning path) ───
        if (!Schema::hasTable('academy_learning_path_enrollments')) {
            Schema::create('academy_learning_path_enrollments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('learning_path_id')->constrained('academy_learning_paths')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamp('enrolled_at')->useCurrent();
                $table->timestamp('completed_at')->nullable();
                $table->unsignedTinyInteger('progress_pct')->default(0);
                $table->timestamps();
                $table->unique(['learning_path_id', 'user_id'], 'alpe_path_user_uq');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('academy_learning_path_enrollments');
        Schema::dropIfExists('academy_contents');
        Schema::dropIfExists('academy_learning_paths');
    }
};
