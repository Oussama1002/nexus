<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Account Management (Pilotage de marque) — full spec migration.
 * Creates ~18 tables under the `am_` prefix. Idempotent so re-runs are safe.
 *
 * Template tables hold Brandna-editable configuration (roadmap models,
 * chantier definitions, gate criteria, QA grids, health-score weights,
 * alert rules, client report templates). Instance tables are created per
 * brand when the Manager OPS opens a roadmap.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ═══════════ CONFIGURATION TEMPLATES ═══════════

        // ─── 1. Roadmap templates (feuille de route models) ───
        if (!Schema::hasTable('am_roadmap_templates')) {
            Schema::create('am_roadmap_templates', function (Blueprint $table) {
                $table->id();
                $table->string('code', 40)->unique();       // e.g. "default", "internal-brand"
                $table->string('label');
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->boolean('is_default')->default(false);
                $table->timestamps();
            });
        }

        // ─── 2. Chantier templates (SOP-01 to SOP-08) ───
        if (!Schema::hasTable('am_chantier_templates')) {
            Schema::create('am_chantier_templates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('roadmap_template_id')->constrained('am_roadmap_templates')->cascadeOnDelete();
                $table->string('code', 20);                 // "SOP-01" … "SOP-08"
                $table->string('label');
                $table->text('objective');
                $table->text('trigger')->nullable();
                $table->json('prerequisite_gate_codes')->nullable();  // ["G0"], etc.
                $table->json('steps_json')->nullable();               // ordered steps
                $table->json('expected_deliverable_types_json')->nullable();
                $table->json('output_kpis_json')->nullable();
                $table->string('academy_sop_ref', 100)->nullable();
                $table->unsignedTinyInteger('sort_order')->default(0);
                $table->timestamps();
                $table->unique(['roadmap_template_id', 'code'], 'am_ct_roadmap_code_uq');
            });
        }

        // ─── 3. Gate templates (G0 to G8) ───
        if (!Schema::hasTable('am_gate_templates')) {
            Schema::create('am_gate_templates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('roadmap_template_id')->constrained('am_roadmap_templates')->cascadeOnDelete();
                $table->foreignId('chantier_template_id')->nullable()->constrained('am_chantier_templates')->nullOnDelete();
                $table->string('code', 8);                          // "G0" … "G8"
                $table->string('label');
                $table->text('description')->nullable();
                $table->string('validator_role', 40)->default('manager_operationnel');   // "admin" for G1/G2/G8
                $table->json('unlocks_gate_codes_json')->nullable();  // downstream gates this one unlocks
                $table->json('unlocks_modules_json')->nullable();     // ["media_buying"] etc.
                $table->boolean('is_scaling_gate')->default(false);   // only G8 typically
                $table->boolean('is_conversion_gate')->default(false);// only G7 typically
                $table->unsignedTinyInteger('sort_order')->default(0);
                $table->timestamps();
                $table->unique(['roadmap_template_id', 'code'], 'am_gt_roadmap_code_uq');
            });
        }

        // ─── 4. Gate criteria templates ───
        if (!Schema::hasTable('am_gate_criteria_templates')) {
            Schema::create('am_gate_criteria_templates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('gate_template_id')->constrained('am_gate_templates')->cascadeOnDelete();
                $table->string('label');
                $table->string('verification_mode', 30);          // "calculated_indicator" | "validated_deliverable" | "attestation"
                $table->string('source', 100)->nullable();        // e.g. "brand_economics.ltv_cac_ratio"
                $table->string('operator', 10)->nullable();       // ">=" "<=" "=="
                $table->decimal('threshold', 14, 4)->nullable();
                $table->text('description')->nullable();
                $table->boolean('is_mandatory')->default(true);
                $table->unsignedTinyInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        // ─── 5. QA grid templates ───
        if (!Schema::hasTable('am_qa_grid_templates')) {
            Schema::create('am_qa_grid_templates', function (Blueprint $table) {
                $table->id();
                $table->string('deliverable_type', 60);   // "brand_book", "landing_page", "creative_video", etc.
                $table->string('label');
                $table->text('description')->nullable();
                $table->json('criteria_json');            // [{ label, is_mandatory, weight }]
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->index('deliverable_type', 'am_qag_type_idx');
            });
        }

        // ─── 6. Health score configuration (per brand or default) ───
        if (!Schema::hasTable('am_health_score_configs')) {
            Schema::create('am_health_score_configs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
                $table->string('code', 40)->default('default');
                $table->json('weights_json');       // { economics: 0.4, conversion: 0.25, execution: 0.2, risk: 0.15 }
                $table->json('components_json');    // detail per component with source ref
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->index(['brand_id', 'is_active'], 'am_hsc_brand_active_idx');
            });
        }

        // ─── 7. Alert rule templates (thresholds are configurable) ───
        if (!Schema::hasTable('am_alert_rule_templates')) {
            Schema::create('am_alert_rule_templates', function (Blueprint $table) {
                $table->id();
                $table->string('code', 40)->unique();       // "AM-16", "AM-17", …
                $table->string('label');
                $table->string('severity', 20)->default('medium');  // low|medium|high|critical
                $table->string('trigger_type', 40);          // "threshold" | "schedule" | "event"
                $table->json('trigger_config_json')->nullable();
                $table->string('default_recipient_role', 40)->nullable();
                $table->unsignedInteger('target_resolution_minutes')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        // ─── 8. Client report templates ───
        if (!Schema::hasTable('am_report_templates')) {
            Schema::create('am_report_templates', function (Blueprint $table) {
                $table->id();
                $table->string('code', 40)->unique();
                $table->string('label');
                $table->json('sections_json');              // ordered sections with source refs
                $table->json('publishable_fields_whitelist');  // MANDATORY — spec §22
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        // ═══════════ ROADMAP INSTANCES ═══════════

        // ─── 9. Roadmaps (feuille de route active per brand) ───
        if (!Schema::hasTable('am_roadmaps')) {
            Schema::create('am_roadmaps', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('template_id')->constrained('am_roadmap_templates')->cascadeOnDelete();
                $table->string('status', 30)->default('en_cours');   // non_demarree|en_cours|suspendue|terminee|abandonnee
                $table->string('brand_lifecycle_stage', 30)->default('cadrage');  // cadrage|construction|lancement|exploitation|scaling|suspendue|cloturee
                $table->foreignId('account_manager_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('opened_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('opened_at')->nullable();
                $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('approved_at')->nullable();
                $table->date('target_end_date')->nullable();
                $table->timestamp('last_gate_transit_at')->nullable();
                $table->string('current_gate_code', 8)->nullable();
                $table->text('closure_summary')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->unique(['brand_id', 'status'], 'am_rm_brand_status_uq');  // one active roadmap per brand
                $table->index(['brand_id', 'brand_lifecycle_stage'], 'am_rm_brand_stage_idx');
            });
        }

        // ─── 10. Chantiers (workstreams) — 8 per roadmap ───
        if (!Schema::hasTable('am_chantiers')) {
            Schema::create('am_chantiers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('roadmap_id')->constrained('am_roadmaps')->cascadeOnDelete();
                $table->foreignId('template_id')->constrained('am_chantier_templates')->cascadeOnDelete();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->string('code', 20);        // duplicate for query convenience
                $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('opened_at')->nullable();
                $table->date('deadline')->nullable();
                $table->string('status', 30)->default('verrouille');   // verrouille|ouvert|en_cours|en_validation|franchi|bloque|abandonne
                $table->text('lock_reason')->nullable();               // which upstream gate is missing
                $table->json('steps_state_json')->nullable();          // per-step completion
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'am_ch_brand_status_idx');
                $table->index('roadmap_id', 'am_ch_roadmap_idx');
            });
        }

        // ─── 11. Gates (portes) — 9 per roadmap ───
        if (!Schema::hasTable('am_gates')) {
            Schema::create('am_gates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('roadmap_id')->constrained('am_roadmaps')->cascadeOnDelete();
                $table->foreignId('template_id')->constrained('am_gate_templates')->cascadeOnDelete();
                $table->foreignId('chantier_id')->nullable()->constrained('am_chantiers')->nullOnDelete();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->string('code', 8);                             // duplicate for fast lookup
                $table->string('status', 30)->default('non_atteinte'); // non_atteinte|criteres_en_cours|demandee|franchie|refusee|franchie_par_derogation
                $table->foreignId('requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('requested_at')->nullable();
                $table->foreignId('validated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('validated_at')->nullable();
                $table->text('refusal_reason')->nullable();
                $table->timestamps();
                $table->unique(['roadmap_id', 'code'], 'am_g_rm_code_uq');
                $table->index(['brand_id', 'code', 'status'], 'am_g_brand_code_status_idx');
            });
        }

        // ─── 12. Gate criteria instances ───
        if (!Schema::hasTable('am_gate_criteria')) {
            Schema::create('am_gate_criteria', function (Blueprint $table) {
                $table->id();
                $table->foreignId('gate_id')->constrained('am_gates')->cascadeOnDelete();
                $table->foreignId('template_id')->constrained('am_gate_criteria_templates')->cascadeOnDelete();
                $table->string('status', 20)->default('non_satisfait'); // satisfait|non_satisfait|indisponible
                $table->decimal('observed_value', 14, 4)->nullable();
                $table->timestamp('evaluated_at')->nullable();
                // Attestation-mode criteria
                $table->foreignId('attested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('attested_at')->nullable();
                $table->text('attestation_comment')->nullable();
                $table->foreignId('validated_deliverable_id')->nullable();
                $table->timestamps();
                $table->index('gate_id', 'am_gc_gate_idx');
            });
        }

        // ─── 13. Dérogations ───
        if (!Schema::hasTable('am_derogations')) {
            Schema::create('am_derogations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('gate_id')->constrained('am_gates')->cascadeOnDelete();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('requested_at')->nullable();
                $table->text('request_reason');
                $table->text('identified_risk');
                $table->text('compensatory_measure');
                $table->string('status', 20)->default('demandee');   // demandee|accordee|refusee|expiree|levee
                $table->foreignId('decided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('decided_at')->nullable();
                $table->text('decision_reason')->nullable();
                $table->timestamp('expires_at')->nullable();          // mandatory when status = accordee, max 30 days from decision
                $table->text('lifting_condition')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'am_der_brand_status_idx');
                $table->index('expires_at', 'am_der_expires_idx');
            });
        }

        // ─── 14. Deliverables (livrables) ───
        if (!Schema::hasTable('am_deliverables')) {
            Schema::create('am_deliverables', function (Blueprint $table) {
                $table->id();
                $table->foreignId('chantier_id')->constrained('am_chantiers')->cascadeOnDelete();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->string('label');
                $table->string('deliverable_type', 60);
                $table->text('expected_description')->nullable();
                $table->foreignId('producer_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->date('deadline')->nullable();
                $table->string('status', 30)->default('a_produire');  // a_produire|en_production|depose|en_controle|valide|a_corriger|refuse|obsolete
                $table->boolean('is_mandatory')->default(true);
                $table->string('current_version', 20)->nullable();
                $table->string('current_asset_url', 500)->nullable();
                $table->foreignId('validated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('validated_at')->nullable();
                $table->text('refusal_reason')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'am_dv_brand_status_idx');
                $table->index('chantier_id', 'am_dv_chantier_idx');
            });
        }

        // ─── 15. Deliverable versions history ───
        if (!Schema::hasTable('am_deliverable_versions')) {
            Schema::create('am_deliverable_versions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('deliverable_id')->constrained('am_deliverables')->cascadeOnDelete();
                $table->string('version_label', 20);
                $table->string('asset_url', 500)->nullable();
                $table->foreignId('uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('uploaded_at')->useCurrent();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->index('deliverable_id', 'am_dvv_deliv_idx');
            });
        }

        // ─── 16. QA checks (contrôle qualité) ───
        if (!Schema::hasTable('am_qa_checks')) {
            Schema::create('am_qa_checks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('deliverable_id')->constrained('am_deliverables')->cascadeOnDelete();
                $table->foreignId('grid_template_id')->constrained('am_qa_grid_templates')->cascadeOnDelete();
                $table->json('criteria_scores_json');   // [{ label, verdict, comment }]
                $table->decimal('score', 5, 2)->nullable();
                $table->string('verdict', 20);          // valide|a_corriger|refuse
                $table->text('comment')->nullable();
                $table->foreignId('checked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('checked_at')->useCurrent();
                $table->timestamps();
                $table->index('deliverable_id', 'am_qa_deliv_idx');
            });
        }

        // ─── 17. Brand economics (modèle économique) ───
        if (!Schema::hasTable('am_brand_economics')) {
            Schema::create('am_brand_economics', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->nullable();  // null = consolidated
                $table->string('market', 50)->nullable();     // for multi-market brands
                $table->decimal('selling_price', 12, 2)->default(0);
                $table->decimal('cogs', 12, 2)->default(0);
                $table->decimal('packaging_cost', 12, 2)->default(0);
                $table->decimal('transaction_fee', 12, 2)->default(0);
                $table->decimal('shipping_cost', 12, 2)->default(0);
                $table->decimal('confirmation_cost_per_order', 12, 2)->default(0);
                $table->decimal('aov', 12, 2)->nullable();
                $table->decimal('gross_margin', 8, 4)->nullable();          // calculated
                $table->decimal('gross_margin_target', 8, 4)->default(0.70);
                $table->decimal('target_cac', 12, 2)->nullable();
                $table->decimal('observed_cac', 12, 2)->nullable();
                $table->decimal('ltv', 12, 2)->nullable();
                $table->decimal('ltv_cac_ratio', 8, 4)->nullable();         // calculated
                $table->decimal('ltv_cac_threshold', 8, 4)->default(3.0);   // spec §15.1
                $table->decimal('net_margin_per_order', 12, 2)->nullable(); // calculated
                $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('last_updated_at')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'product_id', 'market'], 'am_be_brand_prod_mkt_idx');
            });
        }

        // ─── 18. Brand objectives ───
        if (!Schema::hasTable('am_brand_objectives')) {
            Schema::create('am_brand_objectives', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->string('period', 20);
                $table->string('metric_code', 60);
                $table->decimal('target_value', 14, 4);
                $table->decimal('observed_value', 14, 4)->nullable();
                $table->foreignId('set_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['brand_id', 'period'], 'am_bo_brand_period_idx');
            });
        }

        // ─── 19. Decisions journal (immutable) ───
        if (!Schema::hasTable('am_decisions')) {
            Schema::create('am_decisions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->timestamp('decided_at')->useCurrent();
                $table->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->text('subject');
                $table->text('context')->nullable();
                $table->string('invoked_indicator', 100)->nullable();
                $table->string('invoked_value', 100)->nullable();
                $table->text('decision_taken');
                $table->text('rejected_alternative')->nullable();
                $table->text('expected_consequence')->nullable();
                $table->string('linked_object_type', 30)->nullable();
                $table->unsignedBigInteger('linked_object_id')->nullable();
                $table->date('review_date')->nullable();
                $table->text('reviewed_outcome')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'decided_at'], 'am_dec_brand_time_idx');
                $table->index(['linked_object_type', 'linked_object_id'], 'am_dec_link_idx');
            });
        }

        // ─── 20. Tests journal ───
        if (!Schema::hasTable('am_tests')) {
            Schema::create('am_tests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('chantier_id')->nullable()->constrained('am_chantiers')->nullOnDelete();
                $table->text('hypothesis');
                $table->string('tested_variable', 100);
                $table->string('population_or_channel', 100)->nullable();
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->decimal('budget_engaged', 12, 2)->nullable();
                $table->string('success_metric', 60);
                $table->decimal('success_threshold', 14, 4);
                $table->decimal('observed_result', 14, 4)->nullable();
                $table->string('status', 30)->default('planifie'); // planifie|en_cours|termine_sans_verdict|coupe|itere|scale
                $table->string('verdict', 20)->nullable();          // couper|iterer|scaler
                $table->timestamp('verdict_at')->nullable();
                $table->foreignId('verdict_author_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->text('reusable_asset_notes')->nullable();
                $table->string('linked_ref_type', 30)->nullable();  // "campaign" | "content"
                $table->unsignedBigInteger('linked_ref_id')->nullable();
                $table->foreignId('parent_test_id')->nullable()->constrained('am_tests')->nullOnDelete();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'am_te_brand_status_idx');
            });
        }

        // ─── 21. Compliance checks (contrôle de conformité) ───
        if (!Schema::hasTable('am_compliance_checks')) {
            Schema::create('am_compliance_checks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('product_id')->nullable();
                $table->string('market', 50);
                $table->string('product_type', 30)->nullable();  // "complement" | "cosmetique"
                $table->json('checkpoints_json')->nullable();     // [{ label, verdict, evidence_url, responsible_user_id }]
                $table->foreignId('responsible_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status', 30)->default('a_verifier'); // a_verifier|en_verification|conforme|non_conforme|suspendu
                $table->timestamp('last_verified_at')->nullable();
                $table->date('review_due_date')->nullable();
                $table->timestamps();
                $table->unique(['brand_id', 'product_id', 'market'], 'am_cc_brand_prod_mkt_uq');
                $table->index(['brand_id', 'status'], 'am_cc_brand_status_idx');
            });
        }

        // ─── 22. Diffusion suspensions (blocks campaigns + contents) ───
        if (!Schema::hasTable('am_diffusion_suspensions')) {
            Schema::create('am_diffusion_suspensions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('compliance_check_id')->nullable()->constrained('am_compliance_checks')->nullOnDelete();
                $table->foreignId('product_id')->nullable();
                $table->text('reason');
                $table->foreignId('suspended_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('suspended_at')->useCurrent();
                $table->foreignId('lifted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('lifted_at')->nullable();
                $table->text('lifting_reason')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->index(['brand_id', 'is_active'], 'am_ds_brand_active_idx');
            });
        }

        // ─── 23. Alerts + escalations ───
        if (!Schema::hasTable('am_alerts')) {
            Schema::create('am_alerts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->string('rule_code', 40)->nullable();
                $table->string('severity', 20)->default('medium'); // low|medium|high|critical
                $table->string('label');
                $table->text('description')->nullable();
                $table->string('trigger_value', 100)->nullable();
                $table->timestamp('opened_at')->useCurrent();
                $table->foreignId('recipient_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->unsignedInteger('target_resolution_minutes')->nullable();
                $table->string('status', 20)->default('ouverte'); // ouverte|prise_en_charge|resolue|escaladee|close_sans_suite
                $table->timestamp('taken_at')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->text('resolution_action')->nullable();
                $table->text('closure_reason')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'status', 'severity'], 'am_al_brand_st_sev_idx');
            });
        }

        if (!Schema::hasTable('am_alert_escalations')) {
            Schema::create('am_alert_escalations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('alert_id')->constrained('am_alerts')->cascadeOnDelete();
                $table->unsignedTinyInteger('level');    // 1 = manager_ops, 2 = direction
                $table->foreignId('escalated_to_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('escalated_at')->useCurrent();
                $table->timestamps();
                $table->index('alert_id', 'am_ae_alert_idx');
            });
        }

        // ─── 24. Brand assignments (personne rattachée à une marque) ───
        if (!Schema::hasTable('am_brand_assignments')) {
            Schema::create('am_brand_assignments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('role_on_brand', 40);   // "account_manager" | "media_buyer" | "smm" etc.
                $table->decimal('quotity_percent', 5, 2)->default(0);
                $table->unsignedInteger('quotity_hours_per_week')->nullable();
                $table->date('starts_at');
                $table->date('ends_at')->nullable();
                $table->string('status', 20)->default('active'); // active|terminee
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'am_ba_brand_status_idx');
                $table->index('user_id', 'am_ba_user_idx');
            });
        }

        // ─── 25. Client meetings + action items ───
        if (!Schema::hasTable('am_client_meetings')) {
            Schema::create('am_client_meetings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->timestamp('scheduled_at');
                $table->json('internal_participants_json')->nullable();
                $table->json('brand_participants_json')->nullable();
                $table->text('agenda')->nullable();
                $table->text('topics_covered')->nullable();
                $table->text('decisions_taken')->nullable();
                $table->string('status', 30)->default('planifie'); // planifie|tenu|compte_rendu_a_rediger|cloture|annule
                $table->foreignId('minutes_author_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('held_at')->nullable();
                $table->timestamp('closed_at')->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'am_cm_brand_status_idx');
            });
        }

        if (!Schema::hasTable('am_meeting_actions')) {
            Schema::create('am_meeting_actions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('meeting_id')->constrained('am_client_meetings')->cascadeOnDelete();
                $table->text('action');
                $table->foreignId('assignee_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->date('due_date')->nullable();
                $table->string('status', 20)->default('open'); // open|done|cancelled
                $table->timestamp('done_at')->nullable();
                $table->timestamps();
                $table->index('meeting_id', 'am_ma_meeting_idx');
            });
        }

        // ─── 26. Client reports ───
        if (!Schema::hasTable('am_client_reports')) {
            Schema::create('am_client_reports', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('template_id')->constrained('am_report_templates')->cascadeOnDelete();
                $table->string('period', 20);
                $table->json('sections_data_json')->nullable();
                $table->text('account_manager_comment')->nullable();
                $table->string('status', 20)->default('brouillon'); // brouillon|a_valider|valide|publie|retire
                $table->foreignId('drafted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('validated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('validated_at')->nullable();
                $table->foreignId('published_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('published_at')->nullable();
                $table->json('recipient_user_ids_json')->nullable();
                $table->timestamp('acknowledged_at')->nullable();
                $table->string('version', 20)->nullable();
                $table->timestamps();
                $table->index(['brand_id', 'status'], 'am_cr_brand_status_idx');
            });
        }
    }

    public function down(): void
    {
        // Instance tables first (respect FKs), then templates.
        foreach ([
            'am_client_reports', 'am_meeting_actions', 'am_client_meetings',
            'am_brand_assignments', 'am_alert_escalations', 'am_alerts',
            'am_diffusion_suspensions', 'am_compliance_checks', 'am_tests',
            'am_decisions', 'am_brand_objectives', 'am_brand_economics',
            'am_qa_checks', 'am_deliverable_versions', 'am_deliverables',
            'am_derogations', 'am_gate_criteria', 'am_gates', 'am_chantiers',
            'am_roadmaps',
            'am_report_templates', 'am_alert_rule_templates',
            'am_health_score_configs', 'am_qa_grid_templates',
            'am_gate_criteria_templates', 'am_gate_templates',
            'am_chantier_templates', 'am_roadmap_templates',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
