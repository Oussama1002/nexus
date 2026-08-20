<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── 1. Expand employees table with spec fields ───
        if (Schema::hasTable('employees')) {
            Schema::table('employees', function (Blueprint $table) {
                if (!Schema::hasColumn('employees', 'cin')) {
                    $table->string('cin', 20)->nullable()->after('full_name');
                }
                if (!Schema::hasColumn('employees', 'cnss_number')) {
                    $table->string('cnss_number', 30)->nullable()->after('cin');
                }
                if (!Schema::hasColumn('employees', 'birth_date')) {
                    $table->date('birth_date')->nullable()->after('cnss_number');
                }
                if (!Schema::hasColumn('employees', 'gender')) {
                    $table->string('gender', 10)->nullable()->after('birth_date');
                }
                if (!Schema::hasColumn('employees', 'marital_status')) {
                    $table->string('marital_status', 20)->nullable()->after('gender');
                }
                if (!Schema::hasColumn('employees', 'children_count')) {
                    $table->unsignedTinyInteger('children_count')->default(0)->after('marital_status');
                }
                if (!Schema::hasColumn('employees', 'address')) {
                    $table->text('address')->nullable()->after('children_count');
                }
                if (!Schema::hasColumn('employees', 'city')) {
                    $table->string('city', 100)->nullable()->after('address');
                }
                if (!Schema::hasColumn('employees', 'email')) {
                    $table->string('email')->nullable()->after('city');
                }
                if (!Schema::hasColumn('employees', 'emergency_contact_name')) {
                    $table->string('emergency_contact_name')->nullable()->after('email');
                }
                if (!Schema::hasColumn('employees', 'emergency_contact_phone')) {
                    $table->string('emergency_contact_phone', 30)->nullable()->after('emergency_contact_name');
                }
                // Contract fields
                if (!Schema::hasColumn('employees', 'contract_type')) {
                    $table->string('contract_type', 20)->default('cdi')->after('emergency_contact_phone');
                }
                if (!Schema::hasColumn('employees', 'contract_start_date')) {
                    $table->date('contract_start_date')->nullable()->after('contract_type');
                }
                if (!Schema::hasColumn('employees', 'contract_end_date')) {
                    $table->date('contract_end_date')->nullable()->after('contract_start_date');
                }
                if (!Schema::hasColumn('employees', 'trial_end_date')) {
                    $table->date('trial_end_date')->nullable()->after('contract_end_date');
                }
                if (!Schema::hasColumn('employees', 'rib')) {
                    $table->string('rib', 30)->nullable()->after('trial_end_date');
                }
                // Leave balance
                if (!Schema::hasColumn('employees', 'leave_balance_days')) {
                    $table->decimal('leave_balance_days', 5, 1)->default(0)->after('rib');
                }
                if (!Schema::hasColumn('employees', 'leave_accrual_rate')) {
                    $table->decimal('leave_accrual_rate', 4, 2)->default(1.5)->after('leave_balance_days');
                }
                // Manager
                if (!Schema::hasColumn('employees', 'manager_employee_id')) {
                    $table->foreignId('manager_employee_id')->nullable()->after('leave_accrual_rate');
                }
                // Onboarding
                if (!Schema::hasColumn('employees', 'onboarding_status')) {
                    $table->string('onboarding_status', 20)->default('pending')->after('manager_employee_id');
                }
                if (!Schema::hasColumn('employees', 'onboarding_completed_at')) {
                    $table->timestamp('onboarding_completed_at')->nullable()->after('onboarding_status');
                }
                // Departure
                if (!Schema::hasColumn('employees', 'departure_date')) {
                    $table->date('departure_date')->nullable()->after('onboarding_completed_at');
                }
                if (!Schema::hasColumn('employees', 'departure_reason')) {
                    $table->text('departure_reason')->nullable()->after('departure_date');
                }
                if (!Schema::hasColumn('employees', 'notes')) {
                    $table->text('notes')->nullable()->after('departure_reason');
                }
            });
        }

        // ─── 2. Leave requests (Congés) ───
        if (!Schema::hasTable('hr_leave_requests')) {
            Schema::create('hr_leave_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
                $table->string('leave_type', 30)->default('conge_paye');
                $table->date('start_date');
                $table->date('end_date');
                $table->decimal('days_count', 4, 1);
                $table->text('reason')->nullable();
                $table->string('attachment_url', 500)->nullable();
                $table->string('status', 20)->default('en_attente');
                $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('approved_at')->nullable();
                $table->text('approval_comment')->nullable();
                $table->text('refusal_reason')->nullable();
                $table->timestamps();
            });
        }

        // ─── 3. Recruitment - Job openings (Postes ouverts) ───
        if (!Schema::hasTable('hr_job_openings')) {
            Schema::create('hr_job_openings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('title');
                $table->string('department')->nullable();
                $table->text('description')->nullable();
                $table->text('requirements')->nullable();
                $table->string('contract_type', 20)->default('cdi');
                $table->string('location')->nullable();
                $table->decimal('salary_min', 12, 2)->nullable();
                $table->decimal('salary_max', 12, 2)->nullable();
                $table->string('status', 20)->default('ouvert');
                $table->unsignedInteger('positions_count')->default(1);
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->date('published_at')->nullable();
                $table->date('closed_at')->nullable();
                $table->timestamps();
            });
        }

        // ─── 4. Recruitment - Candidatures ───
        if (!Schema::hasTable('hr_candidates')) {
            Schema::create('hr_candidates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('job_opening_id')->nullable()->constrained('hr_job_openings')->nullOnDelete();
                $table->string('full_name');
                $table->string('email')->nullable();
                $table->string('phone', 30)->nullable();
                $table->string('city')->nullable();
                $table->string('cv_url', 500)->nullable();
                $table->string('cover_letter_url', 500)->nullable();
                $table->string('source', 50)->nullable();
                $table->string('status', 30)->default('recue');
                $table->text('notes')->nullable();
                $table->text('refusal_reason')->nullable();
                // Interview tracking
                $table->timestamp('contacted_at')->nullable();
                $table->timestamp('interview_at')->nullable();
                $table->text('interview_notes')->nullable();
                $table->unsignedTinyInteger('interview_rating')->nullable();
                // Decision
                $table->foreignId('decided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('decided_at')->nullable();
                // Conversion to employee
                $table->foreignId('converted_employee_id')->nullable()->constrained('employees')->nullOnDelete();
                $table->timestamps();
            });
        }

        // ─── 5. Onboarding checklist items ───
        if (!Schema::hasTable('hr_onboarding_items')) {
            Schema::create('hr_onboarding_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
                $table->string('item_key', 50);
                $table->string('label');
                $table->boolean('is_completed')->default(false);
                $table->timestamp('completed_at')->nullable();
                $table->foreignId('completed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        // ─── 6. Payroll periods & bulletins ───
        if (!Schema::hasTable('hr_payroll_periods')) {
            Schema::create('hr_payroll_periods', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->unsignedSmallInteger('year');
                $table->unsignedTinyInteger('month');
                $table->string('status', 20)->default('ouvert');
                $table->foreignId('validated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('validated_at')->nullable();
                $table->timestamps();
                $table->unique(['brand_id', 'year', 'month']);
            });
        }

        if (!Schema::hasTable('hr_payroll_bulletins')) {
            Schema::create('hr_payroll_bulletins', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('payroll_period_id')->constrained('hr_payroll_periods')->cascadeOnDelete();
                $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
                $table->decimal('base_salary', 12, 2)->default(0);
                $table->unsignedSmallInteger('days_worked')->default(0);
                $table->unsignedSmallInteger('days_absent_unjustified')->default(0);
                $table->unsignedSmallInteger('days_absent_justified')->default(0);
                $table->unsignedSmallInteger('days_leave')->default(0);
                $table->decimal('overtime_hours', 6, 2)->default(0);
                $table->decimal('overtime_amount', 10, 2)->default(0);
                $table->decimal('primes', 10, 2)->default(0);
                $table->decimal('indemnites', 10, 2)->default(0);
                $table->decimal('retenues', 10, 2)->default(0);
                $table->decimal('absence_deduction', 10, 2)->default(0);
                $table->decimal('cnss_employee', 10, 2)->default(0);
                $table->decimal('ir', 10, 2)->default(0);
                $table->decimal('net_salary', 12, 2)->default(0);
                $table->json('details_json')->nullable();
                $table->text('notes')->nullable();
                $table->string('status', 20)->default('brouillon');
                $table->foreignId('validated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('validated_at')->nullable();
                $table->timestamps();
                $table->unique(['payroll_period_id', 'employee_id']);
            });
        }

        // ─── 7. Training records (Formation) ───
        if (!Schema::hasTable('hr_training_records')) {
            Schema::create('hr_training_records', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
                $table->string('title');
                $table->string('training_type', 30)->default('interne');
                $table->string('provider')->nullable();
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->unsignedSmallInteger('duration_hours')->nullable();
                $table->string('status', 20)->default('planifiee');
                $table->string('result', 20)->nullable();
                $table->string('attestation_url', 500)->nullable();
                $table->text('description')->nullable();
                $table->text('needs_identified_by')->nullable();
                $table->foreignId('requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        // ─── 8. Evaluations ───
        if (!Schema::hasTable('hr_evaluation_campaigns')) {
            Schema::create('hr_evaluation_campaigns', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('title');
                $table->unsignedSmallInteger('year');
                $table->string('period', 20)->default('annuelle');
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->string('status', 20)->default('brouillon');
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('hr_evaluations')) {
            Schema::create('hr_evaluations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('campaign_id')->nullable()->constrained('hr_evaluation_campaigns')->nullOnDelete();
                $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
                $table->foreignId('evaluator_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->json('objectives_json')->nullable();
                $table->json('results_json')->nullable();
                $table->text('manager_appreciation')->nullable();
                $table->unsignedTinyInteger('overall_rating')->nullable();
                $table->text('employee_comment')->nullable();
                $table->string('recommendation', 30)->nullable();
                $table->string('status', 20)->default('en_preparation');
                $table->timestamp('interview_at')->nullable();
                $table->timestamp('signed_by_employee_at')->nullable();
                $table->timestamp('signed_by_manager_at')->nullable();
                $table->timestamp('finalized_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        // ─── 9. Career events (Évolution de carrière) ───
        if (!Schema::hasTable('hr_career_events')) {
            Schema::create('hr_career_events', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
                $table->string('event_type', 30);
                $table->date('effective_date');
                $table->string('old_value')->nullable();
                $table->string('new_value')->nullable();
                $table->text('description')->nullable();
                $table->foreignId('evaluation_id')->nullable()->constrained('hr_evaluations')->nullOnDelete();
                $table->foreignId('decided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        // ─── 10. Discipline ───
        if (!Schema::hasTable('hr_discipline_records')) {
            Schema::create('hr_discipline_records', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
                $table->string('incident_type', 30);
                $table->date('incident_date');
                $table->text('incident_description');
                $table->string('sanction_type', 30)->nullable();
                $table->text('sanction_description')->nullable();
                $table->string('status', 20)->default('signale');
                // Entretien
                $table->timestamp('interview_at')->nullable();
                $table->text('interview_notes')->nullable();
                // Decision
                $table->foreignId('decided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('decided_at')->nullable();
                // Notification
                $table->timestamp('notified_at')->nullable();
                $table->timestamp('acknowledged_at')->nullable();
                // Annulation
                $table->boolean('is_cancelled')->default(false);
                $table->text('cancellation_reason')->nullable();
                $table->foreignId('cancelled_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('cancelled_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        // ─── 11. HR Documents ───
        if (!Schema::hasTable('hr_documents')) {
            Schema::create('hr_documents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
                $table->string('title');
                $table->string('document_type', 30)->default('autre');
                $table->string('file_url', 500);
                $table->unsignedInteger('file_size')->nullable();
                $table->string('mime_type', 100)->nullable();
                $table->date('expiry_date')->nullable();
                $table->boolean('is_signed')->default(false);
                $table->timestamp('signed_at')->nullable();
                $table->foreignId('uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        // ─── 12. Internal communications ───
        if (!Schema::hasTable('hr_communications')) {
            Schema::create('hr_communications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('title');
                $table->string('comm_type', 30)->default('note_service');
                $table->text('content');
                $table->string('attachment_url', 500)->nullable();
                $table->boolean('requires_acknowledgment')->default(false);
                $table->boolean('requires_signature')->default(false);
                $table->string('target_audience', 30)->default('all');
                $table->json('target_departments_json')->nullable();
                $table->json('target_employee_ids_json')->nullable();
                $table->string('status', 20)->default('brouillon');
                $table->foreignId('published_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('published_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('hr_communication_receipts')) {
            Schema::create('hr_communication_receipts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('communication_id')->constrained('hr_communications')->cascadeOnDelete();
                $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
                $table->boolean('is_read')->default(false);
                $table->timestamp('read_at')->nullable();
                $table->boolean('is_acknowledged')->default(false);
                $table->timestamp('acknowledged_at')->nullable();
                $table->boolean('is_signed')->default(false);
                $table->timestamp('signed_at')->nullable();
                $table->timestamps();
                $table->unique(['communication_id', 'employee_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_communication_receipts');
        Schema::dropIfExists('hr_communications');
        Schema::dropIfExists('hr_documents');
        Schema::dropIfExists('hr_discipline_records');
        Schema::dropIfExists('hr_career_events');
        Schema::dropIfExists('hr_evaluations');
        Schema::dropIfExists('hr_evaluation_campaigns');
        Schema::dropIfExists('hr_training_records');
        Schema::dropIfExists('hr_payroll_bulletins');
        Schema::dropIfExists('hr_payroll_periods');
        Schema::dropIfExists('hr_onboarding_items');
        Schema::dropIfExists('hr_candidates');
        Schema::dropIfExists('hr_job_openings');
        Schema::dropIfExists('hr_leave_requests');

        // Don't drop columns from employees in down() to preserve data
    }
};
