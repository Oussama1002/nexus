<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collab_projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->text('objective')->nullable();
            $table->enum('status', ['draft', 'in_progress', 'blocked', 'review', 'published', 'done'])->default('draft');
            $table->date('due_date')->nullable();
            $table->string('asset_url', 2048)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['brand_id', 'status'], 'collab_projects_brand_status_idx');
        });

        Schema::create('collab_project_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('collab_projects')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('project_role', ['content_creator', 'video_editor', 'copywriter', 'publisher', 'reviewer', 'other']);
            $table->boolean('is_lead')->default(false);
            $table->timestamps();

            $table->unique(['project_id', 'user_id', 'project_role'], 'collab_project_user_role_unique');
            $table->index(['project_id', 'project_role'], 'collab_project_role_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collab_project_members');
        Schema::dropIfExists('collab_projects');
    }
};
