<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── 1. Expand influencers table ───
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE influencers MODIFY status VARCHAR(32) NOT NULL DEFAULT 'reperee'");
        }

        Schema::table('influencers', function (Blueprint $table) {
            if (! Schema::hasColumn('influencers', 'bio')) {
                $table->text('bio')->nullable()->after('niche');
            }
            if (! Schema::hasColumn('influencers', 'city')) {
                $table->string('city', 100)->nullable()->after('bio');
            }
            if (! Schema::hasColumn('influencers', 'platforms_json')) {
                $table->json('platforms_json')->nullable()->after('platform');
            }
            if (! Schema::hasColumn('influencers', 'social_links_json')) {
                $table->json('social_links_json')->nullable()->after('contact_email');
            }
            if (! Schema::hasColumn('influencers', 'qualification_json')) {
                $table->json('qualification_json')->nullable()->after('engagement_rate');
            }
            if (! Schema::hasColumn('influencers', 'qualification_score')) {
                $table->decimal('qualification_score', 5, 2)->nullable()->after('qualification_json');
            }
            if (! Schema::hasColumn('influencers', 'qualified_at')) {
                $table->timestamp('qualified_at')->nullable()->after('qualification_score');
            }
            if (! Schema::hasColumn('influencers', 'qualified_by')) {
                $table->foreignId('qualified_by')->nullable()->after('qualified_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('influencers', 'exclusion_reason')) {
                $table->text('exclusion_reason')->nullable()->after('status');
            }
            if (! Schema::hasColumn('influencers', 'excluded_at')) {
                $table->timestamp('excluded_at')->nullable()->after('exclusion_reason');
            }
            if (! Schema::hasColumn('influencers', 'excluded_by')) {
                $table->foreignId('excluded_by')->nullable()->after('excluded_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('influencers', 'ecartee_reason')) {
                $table->text('ecartee_reason')->nullable()->after('excluded_by');
            }
            if (! Schema::hasColumn('influencers', 'notes')) {
                $table->text('notes')->nullable()->after('ecartee_reason');
            }
            if (! Schema::hasColumn('influencers', 'source')) {
                $table->string('source', 100)->nullable()->after('notes');
            }
            if (! Schema::hasColumn('influencers', 'contacted_at')) {
                $table->timestamp('contacted_at')->nullable()->after('source');
            }
            if (! Schema::hasColumn('influencers', 'contacted_by')) {
                $table->foreignId('contacted_by')->nullable()->after('contacted_at')->constrained('users')->nullOnDelete();
            }
        });

        // ─── 2. Expand influencer_collaborations table ───
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE influencer_collaborations MODIFY status VARCHAR(40) NOT NULL DEFAULT 'brouillon'");
        }

        Schema::table('influencer_collaborations', function (Blueprint $table) {
            if (! Schema::hasColumn('influencer_collaborations', 'description')) {
                $table->text('description')->nullable()->after('title');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'objectives')) {
                $table->text('objectives')->nullable()->after('description');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'brief_url')) {
                $table->string('brief_url', 500)->nullable()->after('contract_url');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'currency')) {
                $table->string('currency', 10)->default('MAD')->after('agreed_amount');
            }
            // V1 validation (démarrage)
            if (! Schema::hasColumn('influencer_collaborations', 'v1_status')) {
                $table->string('v1_status', 20)->nullable()->after('end_date');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v1_requested_by')) {
                $table->foreignId('v1_requested_by')->nullable()->after('v1_status')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v1_requested_at')) {
                $table->timestamp('v1_requested_at')->nullable()->after('v1_requested_by');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v1_decided_by')) {
                $table->foreignId('v1_decided_by')->nullable()->after('v1_requested_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v1_decided_at')) {
                $table->timestamp('v1_decided_at')->nullable()->after('v1_decided_by');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v1_comment')) {
                $table->text('v1_comment')->nullable()->after('v1_decided_at');
            }
            // V2 validation (contractualisation)
            if (! Schema::hasColumn('influencer_collaborations', 'v2_status')) {
                $table->string('v2_status', 20)->nullable()->after('v1_comment');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v2_requested_by')) {
                $table->foreignId('v2_requested_by')->nullable()->after('v2_status')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v2_requested_at')) {
                $table->timestamp('v2_requested_at')->nullable()->after('v2_requested_by');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v2_decided_by')) {
                $table->foreignId('v2_decided_by')->nullable()->after('v2_requested_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v2_decided_at')) {
                $table->timestamp('v2_decided_at')->nullable()->after('v2_decided_by');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v2_comment')) {
                $table->text('v2_comment')->nullable()->after('v2_decided_at');
            }
            // V4 validation (clôture)
            if (! Schema::hasColumn('influencer_collaborations', 'v4_status')) {
                $table->string('v4_status', 20)->nullable()->after('v2_comment');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v4_requested_by')) {
                $table->foreignId('v4_requested_by')->nullable()->after('v4_status')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v4_requested_at')) {
                $table->timestamp('v4_requested_at')->nullable()->after('v4_requested_by');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v4_decided_by')) {
                $table->foreignId('v4_decided_by')->nullable()->after('v4_requested_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v4_decided_at')) {
                $table->timestamp('v4_decided_at')->nullable()->after('v4_decided_by');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'v4_comment')) {
                $table->text('v4_comment')->nullable()->after('v4_decided_at');
            }
            // Onboarding & review
            if (! Schema::hasColumn('influencer_collaborations', 'onboarding_notes')) {
                $table->text('onboarding_notes')->nullable()->after('v4_comment');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'review_notes')) {
                $table->text('review_notes')->nullable()->after('onboarding_notes');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'review_rating')) {
                $table->unsignedTinyInteger('review_rating')->nullable()->after('review_notes');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'reviewed_at')) {
                $table->timestamp('reviewed_at')->nullable()->after('review_rating');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'reviewed_by')) {
                $table->foreignId('reviewed_by')->nullable()->after('reviewed_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('influencer_collaborations', 'pause_reason')) {
                $table->text('pause_reason')->nullable()->after('reviewed_by');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'stop_reason')) {
                $table->text('stop_reason')->nullable()->after('pause_reason');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'refuse_reason')) {
                $table->text('refuse_reason')->nullable()->after('stop_reason');
            }
        });

        // ─── 3. Create influencer_deliverables table ───
        if (! Schema::hasTable('influencer_deliverables')) {
            Schema::create('influencer_deliverables', function (Blueprint $table) {
                $table->id();
                $table->foreignId('collaboration_id')->constrained('influencer_collaborations')->cascadeOnDelete();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->string('title');
                $table->string('content_type', 50);
                $table->string('platform', 50)->nullable();
                $table->unsignedInteger('quantity')->default(1);
                $table->date('due_date')->nullable();
                $table->string('status', 30)->default('a_produire');
                $table->text('description')->nullable();
                $table->text('brief_notes')->nullable();
                $table->string('validated_by_user_id')->nullable();
                $table->timestamp('validated_at')->nullable();
                $table->timestamps();

                $table->index(['collaboration_id', 'status']);
            });
        }

        // ─── 4. Create influencer_published_contents table ───
        if (! Schema::hasTable('influencer_published_contents')) {
            Schema::create('influencer_published_contents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('deliverable_id')->constrained('influencer_deliverables')->cascadeOnDelete();
                $table->foreignId('collaboration_id')->constrained('influencer_collaborations')->cascadeOnDelete();
                $table->foreignId('influencer_id')->constrained()->cascadeOnDelete();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('content_type', 50);
                $table->string('platform', 50);
                $table->string('content_url', 500)->nullable();
                $table->string('screenshot_url', 500)->nullable();
                $table->timestamp('published_at')->nullable();
                $table->unsignedInteger('quantity')->default(1);
                $table->boolean('is_archived')->default(false);
                $table->string('archive_url', 500)->nullable();
                $table->boolean('no_publication')->default(false);
                $table->text('no_publication_reason')->nullable();
                $table->unsignedInteger('live_duration_minutes')->nullable();
                $table->unsignedInteger('live_viewers_count')->nullable();
                // Performance metrics
                $table->unsignedBigInteger('views')->default(0);
                $table->unsignedBigInteger('reach')->default(0);
                $table->unsignedBigInteger('impressions')->default(0);
                $table->unsignedBigInteger('likes')->default(0);
                $table->unsignedBigInteger('comments_count')->default(0);
                $table->unsignedBigInteger('shares')->default(0);
                $table->unsignedBigInteger('saves')->default(0);
                $table->unsignedBigInteger('clicks')->default(0);
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['collaboration_id', 'deliverable_id']);
                $table->index(['influencer_id', 'brand_id']);
            });
        }

        // ─── 5. Create influencer_shipments table ───
        if (! Schema::hasTable('influencer_shipments')) {
            Schema::create('influencer_shipments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('collaboration_id')->constrained('influencer_collaborations')->cascadeOnDelete();
                $table->foreignId('influencer_id')->constrained()->cascadeOnDelete();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('reference', 50)->nullable();
                $table->string('status', 30)->default('a_preparer');
                $table->text('products_json');
                $table->string('shipping_company', 100)->nullable();
                $table->string('tracking_number', 100)->nullable();
                $table->string('tracking_url', 500)->nullable();
                $table->date('shipped_at')->nullable();
                $table->date('estimated_delivery')->nullable();
                $table->date('received_at')->nullable();
                $table->text('delivery_address')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['collaboration_id', 'status']);
            });
        }

        // ─── 6. Create influencer_payments table ───
        if (! Schema::hasTable('influencer_payments')) {
            Schema::create('influencer_payments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('collaboration_id')->constrained('influencer_collaborations')->cascadeOnDelete();
                $table->foreignId('influencer_id')->constrained()->cascadeOnDelete();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('reference', 50)->nullable();
                $table->string('nature', 30)->default('remuneration');
                $table->string('status', 40)->default('brouillon');
                $table->decimal('amount', 12, 2)->default(0);
                $table->string('currency', 10)->default('MAD');
                $table->string('payment_method', 50)->nullable();
                $table->text('description')->nullable();
                $table->date('period_start')->nullable();
                $table->date('period_end')->nullable();
                $table->date('due_date')->nullable();
                $table->date('paid_at')->nullable();
                $table->string('proof_url', 500)->nullable();
                // V3 — N1 validation
                $table->string('v3_n1_status', 20)->nullable();
                $table->foreignId('v3_n1_decided_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('v3_n1_decided_at')->nullable();
                $table->text('v3_n1_comment')->nullable();
                // V3 — N2 validation
                $table->string('v3_n2_status', 20)->nullable();
                $table->foreignId('v3_n2_decided_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('v3_n2_decided_at')->nullable();
                $table->text('v3_n2_comment')->nullable();
                $table->text('rejection_reason')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['collaboration_id', 'status']);
                $table->index(['influencer_id', 'brand_id']);
            });
        }

        // ─── 7. Create influencer_documents table ───
        if (! Schema::hasTable('influencer_documents')) {
            Schema::create('influencer_documents', function (Blueprint $table) {
                $table->id();
                $table->foreignId('collaboration_id')->nullable()->constrained('influencer_collaborations')->cascadeOnDelete();
                $table->foreignId('influencer_id')->constrained()->cascadeOnDelete();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('title');
                $table->string('document_type', 50)->default('autre');
                $table->string('file_url', 500);
                $table->unsignedInteger('file_size')->nullable();
                $table->string('mime_type', 100)->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['influencer_id', 'collaboration_id']);
            });
        }

        // ─── 8. Create influencer_validation_requests table ───
        if (! Schema::hasTable('influencer_validation_requests')) {
            Schema::create('influencer_validation_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->string('validation_type', 10);
                $table->string('entity_type', 50);
                $table->unsignedBigInteger('entity_id');
                $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
                $table->timestamp('requested_at');
                $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('decided_at')->nullable();
                $table->string('decision', 20)->nullable();
                $table->text('comment')->nullable();
                $table->json('context_json')->nullable();
                $table->timestamps();

                $table->index(['entity_type', 'entity_id']);
                $table->index(['validation_type', 'decision']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('influencer_validation_requests');
        Schema::dropIfExists('influencer_documents');
        Schema::dropIfExists('influencer_payments');
        Schema::dropIfExists('influencer_shipments');
        Schema::dropIfExists('influencer_published_contents');
        Schema::dropIfExists('influencer_deliverables');
    }
};
