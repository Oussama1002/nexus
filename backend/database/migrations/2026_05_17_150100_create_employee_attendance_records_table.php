<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_attendance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('attendance_date');
            $table->timestamp('clock_in_at')->nullable();
            $table->timestamp('clock_out_at')->nullable();
            $table->enum('status', ['present', 'late', 'absent'])->default('present');
            $table->boolean('was_late')->default(false);
            $table->unsignedInteger('minutes_late')->default(0);
            $table->foreignId('manager_marked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('manager_marked_at')->nullable();
            $table->timestamp('absent_notified_manager_at')->nullable();
            $table->enum('justification_status', ['pending', 'justified', 'unjustified'])->default('pending');
            $table->text('justification_reason')->nullable();
            $table->string('justification_attachment_url', 2048)->nullable();
            $table->decimal('payroll_impact', 12, 2)->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'attendance_date'], 'attendance_employee_date_unique');
            $table->index(['brand_id', 'attendance_date', 'status'], 'attendance_brand_date_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_attendance_records');
    }
};
