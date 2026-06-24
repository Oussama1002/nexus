<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('course_categories', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);

            $table->unique(['brand_id', 'slug']);
            $table->index(['brand_id', 'is_active']);
        });

        Schema::create('certificate_templates', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->longText('html_template');
            $table->string('background_image_url', 2048)->nullable();
            $table->string('signature_image_url', 2048)->nullable();
            $table->boolean('is_active')->default(true);
            $table->index(['brand_id', 'is_active']);
        });

        Schema::create('courses', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_category_id')->nullable()->constrained('course_categories')->nullOnDelete();
            $table->foreignId('certificate_template_id')->nullable()->constrained('certificate_templates')->nullOnDelete();
            $table->string('title');
            $table->string('slug');
            $table->text('short_description')->nullable();
            $table->longText('description')->nullable();
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->enum('enrollment_type', ['free', 'paid'])->default('free');
            $table->decimal('price', 12, 2)->default(0);
            $table->char('currency', 3)->default('USD');
            $table->string('thumbnail_url', 2048)->nullable();
            $table->string('cover_image_url', 2048)->nullable();
            $table->unsignedInteger('duration_minutes')->default(0);
            $table->enum('difficulty_level', ['beginner', 'intermediate', 'advanced'])->default('beginner');
            $table->json('learning_objectives')->nullable();
            $table->json('prerequisites')->nullable();
            $table->string('seo_title')->nullable();
            $table->text('seo_description')->nullable();
            $table->json('seo_keywords')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->boolean('is_featured')->default(false);

            $table->unique(['brand_id', 'slug']);
            $table->index(['brand_id', 'status']);
            $table->index(['brand_id', 'enrollment_type']);
        });

        Schema::create('trainers', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('full_name');
            $table->string('email')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('headline')->nullable();
            $table->text('bio')->nullable();
            $table->json('expertise')->nullable();
            $table->string('avatar_url', 2048)->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->index(['brand_id', 'status']);
        });

        Schema::create('students', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('full_name');
            $table->string('email');
            $table->string('phone', 50)->nullable();
            $table->string('company')->nullable();
            $table->string('position')->nullable();
            $table->string('avatar_url', 2048)->nullable();
            $table->timestamp('last_activity_at')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');

            $table->unique(['brand_id', 'email']);
            $table->index(['brand_id', 'status']);
        });

        Schema::create('coupons', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('applicable_course_id')->nullable()->constrained('courses')->nullOnDelete();
            $table->string('code');
            $table->enum('type', ['percent', 'fixed'])->default('percent');
            $table->decimal('value', 12, 2);
            $table->unsignedInteger('max_redemptions')->nullable();
            $table->unsignedInteger('used_redemptions')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_active')->default(true);

            $table->unique(['brand_id', 'code']);
            $table->index(['brand_id', 'is_active']);
        });

        Schema::create('course_sections', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_published')->default(false);

            $table->index(['course_id', 'sort_order']);
        });

        Schema::create('course_lessons', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('course_section_id')->constrained('course_sections')->cascadeOnDelete();
            $table->string('title');
            $table->enum('lesson_type', ['video', 'pdf', 'text', 'external_link'])->default('text');
            $table->longText('content')->nullable();
            $table->string('video_url', 2048)->nullable();
            $table->string('pdf_url', 2048)->nullable();
            $table->string('external_url', 2048)->nullable();
            $table->unsignedInteger('duration_minutes')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_preview')->default(false);
            $table->boolean('is_published')->default(false);
            $table->timestamp('published_at')->nullable();

            $table->index(['course_section_id', 'sort_order']);
            $table->index(['course_id', 'is_published']);
        });

        Schema::create('lesson_resources', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('course_lesson_id')->constrained('course_lessons')->cascadeOnDelete();
            $table->string('title');
            $table->enum('resource_type', ['file', 'link'])->default('file');
            $table->string('resource_url', 2048)->nullable();
            $table->string('file_path')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->index(['course_lesson_id', 'sort_order']);
        });

        Schema::create('enrollments', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('sales_agent_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['pending', 'active', 'completed', 'expired', 'cancelled'])->default('pending');
            $table->enum('enrollment_type', ['free', 'paid', 'manual', 'bulk'])->default('free');
            $table->decimal('price_paid', 12, 2)->default(0);
            $table->char('currency', 3)->default('USD');
            $table->unsignedTinyInteger('progress_percent')->default(0);
            $table->timestamp('enrolled_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->unique(['course_id', 'student_id']);
            $table->index(['brand_id', 'status']);
        });

        Schema::create('quizzes', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('course_section_id')->nullable()->constrained('course_sections')->nullOnDelete();
            $table->foreignId('course_lesson_id')->nullable()->constrained('course_lessons')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedTinyInteger('passing_score')->default(60);
            $table->unsignedInteger('time_limit_minutes')->nullable();
            $table->unsignedTinyInteger('max_attempts')->default(3);
            $table->boolean('auto_correction')->default(true);
            $table->boolean('randomized_questions')->default(false);
            $table->boolean('is_active')->default(true);
            $table->index(['course_id', 'is_active']);
        });

        Schema::create('quiz_questions', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('quiz_id')->constrained('quizzes')->cascadeOnDelete();
            $table->enum('question_type', ['multiple_choice', 'multiple_answers', 'true_false', 'short_answer']);
            $table->longText('question_text');
            $table->unsignedInteger('points')->default(1);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_required')->default(true);
            $table->index(['quiz_id', 'sort_order']);
        });

        Schema::create('quiz_answers', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('quiz_question_id')->constrained('quiz_questions')->cascadeOnDelete();
            $table->string('answer_text');
            $table->boolean('is_correct')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->index(['quiz_question_id', 'sort_order']);
        });

        Schema::create('quiz_attempts', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('quiz_id')->constrained('quizzes')->cascadeOnDelete();
            $table->foreignId('enrollment_id')->constrained('enrollments')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->enum('status', ['in_progress', 'submitted', 'graded'])->default('in_progress');
            $table->unsignedInteger('score')->default(0);
            $table->unsignedInteger('time_spent_seconds')->default(0);
            $table->boolean('passed')->default(false);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->index(['quiz_id', 'student_id']);
        });

        Schema::create('quiz_attempt_results', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('quiz_attempt_id')->constrained('quiz_attempts')->cascadeOnDelete();
            $table->foreignId('quiz_question_id')->constrained('quiz_questions')->cascadeOnDelete();
            $table->foreignId('quiz_answer_id')->nullable()->constrained('quiz_answers')->nullOnDelete();
            $table->text('answer_text')->nullable();
            $table->boolean('is_correct')->default(false);
            $table->unsignedInteger('points_awarded')->default(0);
            $table->index(['quiz_attempt_id', 'quiz_question_id'], 'quiz_attempt_question_idx');
        });

        Schema::create('lesson_progress', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('enrollment_id')->constrained('enrollments')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('course_lesson_id')->constrained('course_lessons')->cascadeOnDelete();
            $table->enum('status', ['viewed', 'completed'])->default('viewed');
            $table->unsignedInteger('time_spent_seconds')->default(0);
            $table->unsignedInteger('last_position_seconds')->default(0);
            $table->timestamp('viewed_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->unique(['enrollment_id', 'course_lesson_id']);
            $table->index(['student_id', 'status']);
        });

        Schema::create('live_sessions', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('trainer_id')->nullable()->constrained('trainers')->nullOnDelete();
            $table->string('session_title');
            $table->string('meeting_url', 2048);
            $table->timestamp('starts_at');
            $table->unsignedInteger('duration_minutes')->default(60);
            $table->unsignedInteger('attendance_count')->default(0);
            $table->enum('status', ['scheduled', 'completed', 'cancelled'])->default('scheduled');
            $table->string('recording_url', 2048)->nullable();
            $table->index(['course_id', 'starts_at']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('enrollment_id')->nullable()->constrained('enrollments')->nullOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('coupon_id')->nullable()->constrained('coupons')->nullOnDelete();
            $table->enum('payment_method', ['stripe', 'bank_transfer', 'manual'])->default('stripe');
            $table->enum('payment_status', ['pending', 'paid', 'failed', 'refunded', 'cancelled'])->default('pending');
            $table->string('order_number')->nullable();
            $table->string('invoice_number')->nullable();
            $table->string('transaction_reference')->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->char('currency', 3)->default('USD');
            $table->json('gateway_payload')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('validated_at')->nullable();

            $table->index(['brand_id', 'payment_status']);
            $table->index(['student_id', 'paid_at']);
        });

        Schema::create('certificates', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('enrollment_id')->constrained('enrollments')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('certificate_template_id')->nullable()->constrained('certificate_templates')->nullOnDelete();
            $table->string('certificate_number')->unique();
            $table->string('verification_token')->unique();
            $table->string('qr_code_url', 2048)->nullable();
            $table->string('pdf_path')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->index(['student_id', 'issued_at']);
        });

        Schema::create('course_reviews', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('enrollment_id')->nullable()->constrained('enrollments')->nullOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('review')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('moderated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('moderated_at')->nullable();

            $table->unique(['course_id', 'student_id']);
            $table->index(['course_id', 'status']);
        });

        Schema::create('course_announcements', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->string('title');
            $table->text('body');
            $table->timestamp('publish_at')->nullable();
            $table->boolean('is_pinned')->default(false);
            $table->index(['course_id', 'publish_at']);
        });

        Schema::create('academy_notifications', function (Blueprint $table) {
            $this->baseColumns($table);
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('student_id')->nullable()->constrained('students')->nullOnDelete();
            $table->string('type');
            $table->string('title');
            $table->text('message');
            $table->enum('channel', ['email', 'in_app'])->default('in_app');
            $table->enum('status', ['queued', 'sent', 'read', 'failed'])->default('queued');
            $table->json('payload')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->index(['brand_id', 'status']);
            $table->index(['user_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('academy_notifications');
        Schema::dropIfExists('course_announcements');
        Schema::dropIfExists('course_reviews');
        Schema::dropIfExists('certificates');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('live_sessions');
        Schema::dropIfExists('lesson_progress');
        Schema::dropIfExists('quiz_attempt_results');
        Schema::dropIfExists('quiz_attempts');
        Schema::dropIfExists('quiz_answers');
        Schema::dropIfExists('quiz_questions');
        Schema::dropIfExists('quizzes');
        Schema::dropIfExists('enrollments');
        Schema::dropIfExists('lesson_resources');
        Schema::dropIfExists('course_lessons');
        Schema::dropIfExists('course_sections');
        Schema::dropIfExists('coupons');
        Schema::dropIfExists('students');
        Schema::dropIfExists('trainers');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('certificate_templates');
        Schema::dropIfExists('course_categories');
    }

    private function baseColumns(Blueprint $table): void
    {
        $table->id();
        $table->uuid('uuid')->unique();
        $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
        $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
        $table->timestamps();
        $table->softDeletes();
    }
};
