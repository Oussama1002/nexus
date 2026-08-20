<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── 1. Quarterly strategy ───
        if (!Schema::hasTable('smm_strategies')) {
            Schema::create('smm_strategies', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->unsignedSmallInteger('year');
                $table->unsignedTinyInteger('quarter'); // 1..4
                $table->date('start_date');
                $table->date('end_date');
                $table->text('social_objectives');
                $table->text('business_objectives');
                $table->string('brand_stage', 40)->nullable();
                $table->json('platforms_json')->nullable();      // ["instagram","tiktok",...]
                $table->json('platform_roles_json')->nullable(); // {"instagram":"awareness",...}
                $table->json('personas_json')->nullable();       // [persona_id,...] by platform
                $table->json('finalities_json')->nullable();
                $table->json('angles_json')->nullable();
                $table->text('tone_of_voice')->nullable();
                $table->json('priority_formats_json')->nullable();      // {"instagram":["reel","story"]}
                $table->json('publication_frequency_json')->nullable(); // {"instagram":{"per_week":5}}
                $table->json('kpi_targets_json')->nullable();           // [{"indicator":"engagement_rate","target":4}]
                $table->text('quarter_priorities')->nullable();
                $table->string('status', 30)->default('brouillon');
                $table->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('submitted_at')->nullable();
                $table->foreignId('validated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('validated_at')->nullable();
                $table->text('validation_comment')->nullable();
                $table->text('rejection_reason')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'year', 'quarter'], 'smm_strat_brand_q_idx');
            });
        }

        // ─── 2. Content pillars ───
        if (!Schema::hasTable('smm_content_pillars')) {
            Schema::create('smm_content_pillars', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('strategy_id')->constrained('smm_strategies')->cascadeOnDelete();
                $table->string('label');
                $table->text('description')->nullable();
                $table->string('business_objective')->nullable();
                $table->decimal('target_share_percent', 5, 2)->default(0);
                $table->json('formats_json')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->index('strategy_id', 'smm_pillar_strategy_idx');
            });
        }

        // ─── 3. Strategy contributions ───
        if (!Schema::hasTable('smm_strategy_contributions')) {
            Schema::create('smm_strategy_contributions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('strategy_id')->constrained('smm_strategies')->cascadeOnDelete();
                $table->foreignId('contributor_user_id')->constrained('users')->cascadeOnDelete();
                $table->string('role_at_time', 40)->nullable();
                $table->timestamp('requested_at')->nullable();
                $table->timestamp('received_at')->nullable();
                $table->text('contribution')->nullable();
                $table->timestamps();
                $table->unique(['strategy_id', 'contributor_user_id'], 'smm_strat_contrib_uq');
            });
        }

        // ─── 4. Monthly plans ───
        if (!Schema::hasTable('smm_monthly_plans')) {
            Schema::create('smm_monthly_plans', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('strategy_id')->nullable()->constrained('smm_strategies')->nullOnDelete();
                $table->unsignedSmallInteger('year');
                $table->unsignedTinyInteger('month');
                $table->json('volume_by_platform_json')->nullable();
                $table->json('split_by_format_json')->nullable();
                $table->json('split_by_pillar_json')->nullable();
                $table->json('split_by_finality_json')->nullable();
                $table->unsignedInteger('declared_capacity')->nullable();
                $table->string('status', 30)->default('brouillon');
                $table->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('submitted_at')->nullable();
                $table->foreignId('validated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('validated_at')->nullable();
                $table->text('validation_comment')->nullable();
                $table->text('rejection_reason')->nullable();
                $table->timestamps();
                $table->unique(['brand_id', 'year', 'month'], 'smm_plan_brand_ym_uq');
            });
        }

        // ─── 5. Contents (central object) ───
        if (!Schema::hasTable('smm_contents')) {
            Schema::create('smm_contents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('monthly_plan_id')->nullable()->constrained('smm_monthly_plans')->nullOnDelete();
                $table->foreignId('pillar_id')->nullable()->constrained('smm_content_pillars')->nullOnDelete();
                $table->foreignId('event_id')->nullable();
                $table->foreignId('source_content_id')->nullable(); // repurposing
                // Identification
                $table->string('title');
                $table->text('concept')->nullable();
                $table->string('platform', 40);
                $table->string('format', 40);
                $table->string('finality', 40)->nullable();
                $table->string('angle', 100)->nullable();
                $table->foreignId('persona_id')->nullable();
                $table->string('social_account', 100)->nullable();
                // Production
                $table->string('production_mode', 30)->default('interne_smm'); // interne_smm|graphiste|monteur|createur_externe
                $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('briefed_at')->nullable();
                $table->timestamp('production_due_at')->nullable();
                // Planning
                $table->timestamp('scheduled_publish_at')->nullable();
                // Sensitivity
                $table->boolean('is_sensitive')->default(false);
                $table->string('sensitivity_reason', 60)->nullable();
                // Tracking
                $table->string('status', 40)->default('a_briefer');
                $table->unsignedSmallInteger('revision_rounds')->default(0);
                $table->timestamp('validated_at')->nullable();
                $table->foreignId('validated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('transmitted_at')->nullable();
                $table->timestamp('published_at')->nullable();
                $table->string('published_platform_id', 191)->nullable();
                $table->text('not_published_reason')->nullable();
                $table->text('cancellation_reason')->nullable();
                // Naming
                $table->string('file_identifier', 191)->nullable();
                $table->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'smm_content_brand_status_idx');
                $table->index('scheduled_publish_at', 'smm_content_sched_idx');
                $table->index('assigned_user_id', 'smm_content_assigned_idx');
            });
        }

        // ─── 6. Briefs (1:1 with content) ───
        if (!Schema::hasTable('smm_briefs')) {
            Schema::create('smm_briefs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('content_id')->constrained('smm_contents')->cascadeOnDelete();
                $table->text('concept_intention')->nullable();
                $table->text('objective_result')->nullable();
                $table->text('copy_text')->nullable();          // graphiste
                $table->text('script')->nullable();             // monteur (voix off, dialogues)
                $table->text('expected_structure')->nullable();
                $table->text('visual_direction')->nullable();   // graphiste
                $table->text('editing_structure')->nullable();  // monteur
                $table->text('raw_material')->nullable();       // monteur
                $table->text('technical_instructions')->nullable(); // format, durée, sous-titres
                $table->text('references_text')->nullable();
                $table->text('mandatory_info')->nullable(); // prix, offre, mentions
                $table->text('call_to_action')->nullable();
                $table->timestamps();
                $table->unique('content_id', 'smm_brief_content_uq');
            });
        }

        // ─── 7. Content produced versions ───
        if (!Schema::hasTable('smm_content_versions')) {
            Schema::create('smm_content_versions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('content_id')->constrained('smm_contents')->cascadeOnDelete();
                $table->foreignId('uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->unsignedSmallInteger('version_number')->default(1);
                $table->string('file_url', 500);
                $table->string('file_type', 60)->nullable();
                $table->unsignedBigInteger('file_size')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index('content_id', 'smm_ver_content_idx');
            });
        }

        // ─── 8. Revision feedback ───
        if (!Schema::hasTable('smm_content_revisions')) {
            Schema::create('smm_content_revisions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('content_id')->constrained('smm_contents')->cascadeOnDelete();
                $table->foreignId('version_id')->nullable()->constrained('smm_content_versions')->nullOnDelete();
                $table->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->text('feedback');
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();
                $table->index('content_id', 'smm_rev_content_idx');
            });
        }

        // ─── 9. QC checklists ───
        if (!Schema::hasTable('smm_qc_checklists')) {
            Schema::create('smm_qc_checklists', function (Blueprint $table) {
                $table->id();
                $table->foreignId('content_id')->constrained('smm_contents')->cascadeOnDelete();
                $table->foreignId('completed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->json('items_json'); // [{key, label, checked, note}]
                $table->boolean('is_complete')->default(false);
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
                $table->unique('content_id', 'smm_qc_content_uq');
            });
        }

        // ─── 10. Publication slip (fiche de publication) ───
        if (!Schema::hasTable('smm_publication_slips')) {
            Schema::create('smm_publication_slips', function (Blueprint $table) {
                $table->id();
                $table->foreignId('content_id')->constrained('smm_contents')->cascadeOnDelete();
                $table->string('platform', 40);
                $table->timestamp('publish_at');
                $table->text('caption')->nullable();
                $table->text('call_to_action')->nullable();
                $table->text('hashtags')->nullable();
                $table->text('story_instructions')->nullable();   // séquence, ordre, stickers, liens
                $table->text('specific_instructions')->nullable(); // épingler, croiser
                $table->text('sensitive_topics_watch')->nullable();
                $table->json('linked_automation_ids_json')->nullable();
                $table->boolean('is_complete')->default(false);
                $table->timestamps();
                $table->unique('content_id', 'smm_slip_content_uq');
            });
        }

        // ─── 11. Daily execution checks ───
        if (!Schema::hasTable('smm_execution_checks')) {
            Schema::create('smm_execution_checks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('content_id')->nullable()->constrained('smm_contents')->nullOnDelete();
                $table->date('check_date');
                $table->foreignId('checked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status', 30)->default('conforme'); // conforme|ecart_constate|ecart_corrige
                $table->boolean('has_public_impact')->default(false);
                $table->text('deviation_description')->nullable();
                $table->text('correction_note')->nullable();
                $table->timestamp('corrected_at')->nullable();
                $table->boolean('escalated_to_direction')->default(false);
                $table->boolean('unpublished')->default(false);
                $table->timestamps();
                $table->index(['brand_id', 'check_date'], 'smm_exec_brand_date_idx');
            });
        }

        // ─── 12. Veille notes ───
        if (!Schema::hasTable('smm_veille_notes')) {
            Schema::create('smm_veille_notes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->date('week_start_date');
                $table->json('platforms_observed_json')->nullable();
                $table->text('platform_behavior_changes')->nullable();
                $table->timestamps();
            });
        }

        // ─── 13. Veille trends (children of notes) ───
        if (!Schema::hasTable('smm_veille_trends')) {
            Schema::create('smm_veille_trends', function (Blueprint $table) {
                $table->id();
                $table->foreignId('veille_note_id')->constrained('smm_veille_notes')->cascadeOnDelete();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('label');
                $table->string('platform', 40);
                $table->string('decision', 20); // retenue|ecartee
                $table->text('reason'); // obligatoire
                $table->boolean('filter_brand_relevance')->default(false);
                $table->boolean('filter_audience_relevance')->default(false);
                $table->boolean('filter_positioning_coherence')->default(false);
                $table->boolean('filter_execution_effort_ok')->default(false);
                $table->foreignId('generated_content_id')->nullable()->constrained('smm_contents')->nullOnDelete();
                $table->timestamps();
                $table->index('veille_note_id', 'smm_trend_note_idx');
            });
        }

        // ─── 14. Events ───
        if (!Schema::hasTable('smm_events')) {
            Schema::create('smm_events', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('label');
                $table->string('event_type', 20)->default('previsible'); // previsible|temps_reel
                $table->string('amplitude', 30)->nullable();
                $table->date('start_date');
                $table->date('end_date');
                $table->unsignedInteger('anticipation_days')->nullable();
                $table->text('commercial_offers')->nullable();
                $table->json('coordinated_departments_json')->nullable();
                $table->json('milestones_json')->nullable(); // [{date, label, responsible_user_id, done}]
                $table->text('cm_instructions')->nullable();
                $table->string('status', 30)->default('planifie'); // planifie|retroplanning_a_valider|en_preparation|en_cours|termine|annule
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('validated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('validated_at')->nullable();
                $table->boolean('has_commercial_offer')->default(false);
                $table->foreignId('direction_validated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('direction_validated_at')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'start_date'], 'smm_event_brand_start_idx');
            });
        }

        // ─── 15. Automations ───
        if (!Schema::hasTable('smm_automations')) {
            Schema::create('smm_automations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('label');
                $table->string('objective', 40)->nullable(); // lead|information|ressource|nurturing
                $table->string('platform', 40);
                $table->string('trigger_type', 40); // keyword|comment|new_follow|story_interaction
                $table->text('trigger_config')->nullable();
                $table->json('flow_steps_json')->nullable();
                $table->json('messages_json')->nullable();
                $table->text('call_to_action_links')->nullable();
                $table->json('linked_content_ids_json')->nullable();
                $table->string('status', 30)->default('brouillon'); // brouillon|en_test|active|suspendue|archivee
                $table->boolean('test_recorded')->default(false);
                $table->timestamp('tested_at')->nullable();
                $table->foreignId('tested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('activated_at')->nullable();
                $table->foreignId('activated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('suspended_at')->nullable();
                $table->foreignId('suspended_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->text('suspension_reason')->nullable();
                $table->json('kpis_json')->nullable(); // measured KPI values
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'smm_auto_brand_status_idx');
            });
        }

        // ─── 16. Content performances (auto-synced) ───
        if (!Schema::hasTable('smm_content_performances')) {
            Schema::create('smm_content_performances', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('content_id')->constrained('smm_contents')->cascadeOnDelete();
                $table->string('platform', 40);
                $table->timestamp('last_synced_at')->nullable();
                $table->unsignedBigInteger('reach')->default(0);
                $table->unsignedBigInteger('impressions')->default(0);
                $table->unsignedBigInteger('views')->default(0);
                $table->decimal('engagement_rate', 6, 3)->default(0);
                $table->unsignedBigInteger('shares')->default(0);
                $table->unsignedBigInteger('saves')->default(0);
                $table->unsignedBigInteger('comments_count')->default(0);
                $table->unsignedBigInteger('profile_visits')->default(0);
                $table->unsignedBigInteger('followers_gained')->default(0);
                $table->unsignedBigInteger('clicks')->default(0);
                $table->unsignedBigInteger('conversions')->default(0);
                $table->boolean('sync_failed')->default(false);
                $table->text('sync_error')->nullable();
                $table->timestamps();
                $table->unique(['content_id', 'platform'], 'smm_perf_content_plat_uq');
            });
        }

        // ─── 17. Performance history snapshots ───
        if (!Schema::hasTable('smm_performance_snapshots')) {
            Schema::create('smm_performance_snapshots', function (Blueprint $table) {
                $table->id();
                $table->foreignId('content_id')->constrained('smm_contents')->cascadeOnDelete();
                $table->string('platform', 40);
                $table->timestamp('snapshot_at');
                $table->json('metrics_json');
                $table->timestamps();
                $table->index(['content_id', 'snapshot_at'], 'smm_snap_content_time_idx');
            });
        }

        // ─── 18. Learnings ───
        if (!Schema::hasTable('smm_learnings')) {
            Schema::create('smm_learnings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('period', 40)->nullable(); // e.g. "2026-08"
                $table->text('finding');
                $table->string('dimension', 30)->nullable(); // format|hook|pilier|finalite|plateforme|angle
                $table->text('justifying_data')->nullable();
                $table->text('recommendation');
                $table->json('recipient_user_ids_json')->nullable();
                $table->timestamp('communicated_at')->nullable();
                $table->text('next_cycle_effect')->nullable();
                $table->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['brand_id', 'period'], 'smm_learn_brand_period_idx');
            });
        }

        // ─── 19. Monthly reports ───
        if (!Schema::hasTable('smm_monthly_reports')) {
            Schema::create('smm_monthly_reports', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->unsignedSmallInteger('year');
                $table->unsignedTinyInteger('month');
                $table->text('performance_summary')->nullable();
                $table->json('winning_contents_json')->nullable();
                $table->json('underperforming_contents_json')->nullable();
                $table->text('patterns_identified')->nullable();
                // KEEP / STOP / IMPROVE / TEST / SCALE grid
                $table->json('decision_grid_json')->nullable(); // {keep:[], stop:[], improve:[], test:[], scale:[]}
                $table->text('next_month_action_plan')->nullable();
                $table->string('status', 30)->default('en_preparation'); // en_preparation|diffuse
                $table->json('recipient_user_ids_json')->nullable();
                $table->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('diffused_at')->nullable();
                $table->foreignId('diffused_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->unique(['brand_id', 'year', 'month'], 'smm_report_brand_ym_uq');
            });
        }

        // ─── 20. Client insights ───
        if (!Schema::hasTable('smm_client_insights')) {
            Schema::create('smm_client_insights', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('source', 30); // call_center|community_manager|reclamation
                $table->string('insight_type', 30); // objection|question|plainte|verbatim|motif_refus|temoignage
                $table->text('verbatim');
                $table->date('captured_on')->nullable();
                $table->unsignedInteger('observed_frequency')->default(1);
                $table->unsignedBigInteger('complaint_id')->nullable();
                $table->string('status', 30)->default('nouveau'); // nouveau|exploite|ecarte
                $table->text('exclusion_reason')->nullable();
                $table->json('produced_content_ids_json')->nullable();
                $table->foreignId('captured_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('qualified_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('qualified_at')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'smm_insight_brand_status_idx');
            });
        }

        // ─── 21. Content ↔ Automation link (N:N) ───
        if (!Schema::hasTable('smm_content_automation')) {
            Schema::create('smm_content_automation', function (Blueprint $table) {
                $table->foreignId('content_id')->constrained('smm_contents')->cascadeOnDelete();
                $table->foreignId('automation_id')->constrained('smm_automations')->cascadeOnDelete();
                $table->primary(['content_id', 'automation_id'], 'smm_ca_pk');
            });
        }

        // ─── 22. Content ↔ Insight link (N:N) ───
        if (!Schema::hasTable('smm_content_insight')) {
            Schema::create('smm_content_insight', function (Blueprint $table) {
                $table->foreignId('content_id')->constrained('smm_contents')->cascadeOnDelete();
                $table->foreignId('insight_id')->constrained('smm_client_insights')->cascadeOnDelete();
                $table->primary(['content_id', 'insight_id'], 'smm_ci_pk');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('smm_content_insight');
        Schema::dropIfExists('smm_content_automation');
        Schema::dropIfExists('smm_client_insights');
        Schema::dropIfExists('smm_monthly_reports');
        Schema::dropIfExists('smm_learnings');
        Schema::dropIfExists('smm_performance_snapshots');
        Schema::dropIfExists('smm_content_performances');
        Schema::dropIfExists('smm_automations');
        Schema::dropIfExists('smm_events');
        Schema::dropIfExists('smm_veille_trends');
        Schema::dropIfExists('smm_veille_notes');
        Schema::dropIfExists('smm_execution_checks');
        Schema::dropIfExists('smm_publication_slips');
        Schema::dropIfExists('smm_qc_checklists');
        Schema::dropIfExists('smm_content_revisions');
        Schema::dropIfExists('smm_content_versions');
        Schema::dropIfExists('smm_briefs');
        Schema::dropIfExists('smm_contents');
        Schema::dropIfExists('smm_monthly_plans');
        Schema::dropIfExists('smm_strategy_contributions');
        Schema::dropIfExists('smm_content_pillars');
        Schema::dropIfExists('smm_strategies');
    }
};
