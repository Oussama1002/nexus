<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            if (Schema::hasColumn('social_accounts', 'credentials')) {
                DB::statement('ALTER TABLE social_accounts CHANGE credentials credential_ref TEXT NULL');
            }
        } else {
            Schema::table('social_accounts', function (Blueprint $table) {
                if (Schema::hasColumn('social_accounts', 'credentials')) {
                    $table->renameColumn('credentials', 'credential_ref');
                }
            });
        }

        Schema::table('social_accounts', function (Blueprint $table) {
            if (! Schema::hasColumn('social_accounts', 'profile_url')) {
                $table->string('profile_url', 500)->nullable()->after('handle');
            }
        });

        Schema::table('strategies', function (Blueprint $table) {
            if (! Schema::hasColumn('strategies', 'approved_by')) {
                $table->foreignId('approved_by')->nullable()->after('version')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('strategies', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('approved_by');
            }
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE content_calendar MODIFY content_type ENUM('post','story','reel','live','video','carousel') NOT NULL");
            DB::statement("ALTER TABLE content_calendar MODIFY status ENUM('draft','planned','in_production','review','approved','published','cancelled') NOT NULL DEFAULT 'draft'");
        }

        Schema::table('content_production', function (Blueprint $table) {
            if (! Schema::hasColumn('content_production', 'production_type')) {
                $table->string('production_type', 32)->default('shooting')->after('title');
            }
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE content_production MODIFY status ENUM('todo','in_progress','submitted','validated','rejected') NOT NULL DEFAULT 'todo'");
        }

        Schema::table('cm_daily_tracking', function (Blueprint $table) {
            if (! Schema::hasColumn('cm_daily_tracking', 'tasks_done')) {
                $table->unsignedInteger('tasks_done')->default(0);
            }
            if (! Schema::hasColumn('cm_daily_tracking', 'posts_done')) {
                $table->unsignedInteger('posts_done')->default(0);
            }
            if (! Schema::hasColumn('cm_daily_tracking', 'stories_done')) {
                $table->unsignedInteger('stories_done')->default(0);
            }
            if (! Schema::hasColumn('cm_daily_tracking', 'lives_done')) {
                $table->unsignedInteger('lives_done')->default(0);
            }
            if (! Schema::hasColumn('cm_daily_tracking', 'completion_percentage')) {
                $table->unsignedTinyInteger('completion_percentage')->default(0);
            }
            if (! Schema::hasColumn('cm_daily_tracking', 'status')) {
                $table->string('status', 32)->default('pending');
            }
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE influencers MODIFY status ENUM('new','qualified','negotiation','active','blacklisted','inactive') NOT NULL DEFAULT 'new'");
        }

        Schema::table('influencers', function (Blueprint $table) {
            if (! Schema::hasColumn('influencers', 'engagement_rate')) {
                $table->decimal('engagement_rate', 8, 4)->nullable()->after('audience_size');
            }
        });

        if (Schema::hasColumn('influencer_collaborations', 'agreed_cost') && ! Schema::hasColumn('influencer_collaborations', 'agreed_amount')) {
            if (Schema::getConnection()->getDriverName() === 'mysql') {
                DB::statement('ALTER TABLE influencer_collaborations CHANGE agreed_cost agreed_amount DECIMAL(12,2) NOT NULL DEFAULT 0');
            } else {
                Schema::table('influencer_collaborations', function (Blueprint $table) {
                    $table->renameColumn('agreed_cost', 'agreed_amount');
                });
            }
        }

        Schema::table('influencer_collaborations', function (Blueprint $table) {
            if (! Schema::hasColumn('influencer_collaborations', 'collaboration_type')) {
                $table->string('collaboration_type', 32)->default('post')->after('title');
            }
            if (! Schema::hasColumn('influencer_collaborations', 'contract_url')) {
                $table->string('contract_url', 500)->nullable()->after('deliverables');
            }
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE influencer_collaborations MODIFY status ENUM('draft','negotiation','approved','active','completed','cancelled','disputed') NOT NULL DEFAULT 'draft'");
        }

        Schema::table('influencer_messages', function (Blueprint $table) {
            if (Schema::hasColumn('influencer_messages', 'channel')) {
                if (Schema::getConnection()->getDriverName() === 'mysql') {
                    DB::statement("ALTER TABLE influencer_messages MODIFY channel ENUM('whatsapp','instagram','email','phone','other') NULL");
                }
            }
        });

        $this->upgradeInfluencerPerformance();

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE influencer_complaints MODIFY status ENUM('open','in_review','resolved','reopened','closed') NOT NULL DEFAULT 'open'");
        }

        if (Schema::hasColumn('influencer_complaints', 'resolution') && ! Schema::hasColumn('influencer_complaints', 'resolution_notes')) {
            if (Schema::getConnection()->getDriverName() === 'mysql') {
                DB::statement('ALTER TABLE influencer_complaints CHANGE resolution resolution_notes TEXT NULL');
            } else {
                Schema::table('influencer_complaints', function (Blueprint $table) {
                    $table->renameColumn('resolution', 'resolution_notes');
                });
            }
        }

        Schema::table('influencer_complaints', function (Blueprint $table) {
            if (! Schema::hasColumn('influencer_complaints', 'category')) {
                $table->string('category', 32)->default('other')->after('title');
            }
            if (! Schema::hasColumn('influencer_complaints', 'severity')) {
                $table->string('severity', 32)->default('medium')->after('description');
            }
            if (! Schema::hasColumn('influencer_complaints', 'resolution_notes')) {
                $table->text('resolution_notes')->nullable();
            }
        });
    }

    private function upgradeInfluencerPerformance(): void
    {
        if (! Schema::hasTable('influencer_performance')) {
            return;
        }

        Schema::table('influencer_performance', function (Blueprint $table) {
            if (! Schema::hasColumn('influencer_performance', 'reach')) {
                $table->unsignedBigInteger('reach')->default(0)->after('metric_date');
            }
            if (! Schema::hasColumn('influencer_performance', 'impressions')) {
                $table->unsignedBigInteger('impressions')->default(0)->after('reach');
            }
            if (! Schema::hasColumn('influencer_performance', 'likes')) {
                $table->unsignedBigInteger('likes')->default(0)->after('impressions');
            }
            if (! Schema::hasColumn('influencer_performance', 'comments')) {
                $table->unsignedBigInteger('comments')->default(0)->after('likes');
            }
            if (! Schema::hasColumn('influencer_performance', 'shares')) {
                $table->unsignedBigInteger('shares')->default(0)->after('comments');
            }
            if (! Schema::hasColumn('influencer_performance', 'saves')) {
                $table->unsignedBigInteger('saves')->default(0)->after('shares');
            }
            if (! Schema::hasColumn('influencer_performance', 'clicks')) {
                $table->unsignedBigInteger('clicks')->default(0)->after('saves');
            }
            if (! Schema::hasColumn('influencer_performance', 'leads')) {
                $table->unsignedBigInteger('leads')->default(0)->after('clicks');
            }
            if (! Schema::hasColumn('influencer_performance', 'orders')) {
                $table->unsignedBigInteger('orders')->default(0)->after('leads');
            }
            if (! Schema::hasColumn('influencer_performance', 'engagement_rate')) {
                $table->decimal('engagement_rate', 10, 4)->nullable()->after('revenue');
            }
            if (! Schema::hasColumn('influencer_performance', 'conversion_rate')) {
                $table->decimal('conversion_rate', 10, 4)->nullable()->after('engagement_rate');
            }
            if (! Schema::hasColumn('influencer_performance', 'roi_percent')) {
                $table->decimal('roi_percent', 12, 4)->nullable()->after('conversion_rate');
            }
        });

        Schema::table('influencer_performance', function (Blueprint $table) {
            if (Schema::hasColumn('influencer_performance', 'engagement')) {
                $table->dropColumn('engagement');
            }
            if (Schema::hasColumn('influencer_performance', 'conversions')) {
                $table->dropColumn('conversions');
            }
            if (Schema::hasColumn('influencer_performance', 'roi')) {
                $table->dropColumn('roi');
            }
        });
    }

    public function down(): void
    {
        // non-reversible enum / column renames in production; keep empty for safety
    }
};
