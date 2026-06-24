<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collab_columns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('collab_projects')->cascadeOnDelete();
            $table->string('title');
            $table->string('color', 20)->default('#6366f1');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['project_id', 'sort_order']);
        });

        Schema::create('collab_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('collab_projects')->cascadeOnDelete();
            $table->foreignId('column_id')->constrained('collab_columns')->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');
            $table->date('due_date')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['column_id', 'sort_order']);
            $table->index(['project_id', 'assigned_to']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collab_tasks');
        Schema::dropIfExists('collab_columns');
    }
};
