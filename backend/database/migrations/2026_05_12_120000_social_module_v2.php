<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('social_accounts', function (Blueprint $table) {
            if (! Schema::hasColumn('social_accounts', 'responsible_user_id')) {
                $table->foreignId('responsible_user_id')->nullable()->after('brand_id')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('social_accounts', 'api_connected')) {
                $table->boolean('api_connected')->default(false)->after('profile_url');
            }
            if (! Schema::hasColumn('social_accounts', 'follower_count')) {
                $table->unsignedBigInteger('follower_count')->nullable()->after('api_connected');
            }
        });

        Schema::table('strategies', function (Blueprint $table) {
            if (! Schema::hasColumn('strategies', 'marketing_objective')) {
                $table->text('marketing_objective')->nullable()->after('title');
            }
            if (! Schema::hasColumn('strategies', 'target_audience')) {
                $table->text('target_audience')->nullable()->after('marketing_objective');
            }
            if (! Schema::hasColumn('strategies', 'key_message')) {
                $table->text('key_message')->nullable()->after('target_audience');
            }
            if (! Schema::hasColumn('strategies', 'platforms')) {
                $table->json('platforms')->nullable()->after('key_message');
            }
            if (! Schema::hasColumn('strategies', 'expected_kpis')) {
                $table->text('expected_kpis')->nullable()->after('platforms');
            }
            if (! Schema::hasColumn('strategies', 'budget')) {
                $table->decimal('budget', 15, 2)->nullable()->after('expected_kpis');
            }
            if (! Schema::hasColumn('strategies', 'period_start')) {
                $table->date('period_start')->nullable()->after('budget');
            }
            if (! Schema::hasColumn('strategies', 'period_end')) {
                $table->date('period_end')->nullable()->after('period_start');
            }
            if (! Schema::hasColumn('strategies', 'assigned_cm_id')) {
                $table->foreignId('assigned_cm_id')->nullable()->after('period_end')->constrained('users')->nullOnDelete();
            }
        });

        Schema::table('content_calendar', function (Blueprint $table) {
            if (! Schema::hasColumn('content_calendar', 'caption')) {
                $table->text('caption')->nullable()->after('description');
            }
            if (! Schema::hasColumn('content_calendar', 'attachments_json')) {
                $table->json('attachments_json')->nullable()->after('caption');
            }
            if (! Schema::hasColumn('content_calendar', 'validated_by')) {
                $table->foreignId('validated_by')->nullable()->after('published_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('content_calendar', 'validated_at')) {
                $table->timestamp('validated_at')->nullable()->after('validated_by');
            }
        });

        Schema::table('content_production', function (Blueprint $table) {
            if (! Schema::hasColumn('content_production', 'location')) {
                $table->string('location', 255)->nullable()->after('title');
            }
            if (! Schema::hasColumn('content_production', 'equipment_notes')) {
                $table->text('equipment_notes')->nullable()->after('shoot_date');
            }
            if (! Schema::hasColumn('content_production', 'crew_notes')) {
                $table->text('crew_notes')->nullable()->after('equipment_notes');
            }
        });

        Schema::table('cm_daily_tracking', function (Blueprint $table) {
            if (! Schema::hasColumn('cm_daily_tracking', 'work_minutes')) {
                $table->unsignedSmallInteger('work_minutes')->nullable()->after('notes');
            }
        });

        if (! Schema::hasTable('social_publications')) {
            Schema::create('social_publications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('content_calendar_id')->nullable()->constrained('content_calendar')->nullOnDelete();
                $table->foreignId('social_account_id')->nullable()->constrained()->nullOnDelete();
                $table->string('platform', 32);
                $table->string('title')->nullable();
                $table->timestamp('published_at')->nullable();
                $table->unsignedBigInteger('reach')->nullable();
                $table->unsignedBigInteger('likes')->nullable();
                $table->unsignedBigInteger('comments')->nullable();
                $table->unsignedBigInteger('shares')->nullable();
                $table->unsignedBigInteger('saves')->nullable();
                $table->decimal('ctr', 8, 4)->nullable();
                $table->string('source', 16)->default('manual');
                $table->timestamp('synced_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('social_publications');

        Schema::table('cm_daily_tracking', function (Blueprint $table) {
            if (Schema::hasColumn('cm_daily_tracking', 'work_minutes')) {
                $table->dropColumn('work_minutes');
            }
        });

        Schema::table('content_production', function (Blueprint $table) {
            foreach (['location', 'equipment_notes', 'crew_notes'] as $col) {
                if (Schema::hasColumn('content_production', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('content_calendar', function (Blueprint $table) {
            foreach (['caption', 'attachments_json', 'validated_by', 'validated_at'] as $col) {
                if (Schema::hasColumn('content_calendar', $col)) {
                    if ($col === 'validated_by') {
                        $table->dropForeign(['validated_by']);
                    }
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('strategies', function (Blueprint $table) {
            foreach ([
                'marketing_objective', 'target_audience', 'key_message', 'platforms',
                'expected_kpis', 'budget', 'period_start', 'period_end',
            ] as $col) {
                if (Schema::hasColumn('strategies', $col)) {
                    $table->dropColumn($col);
                }
            }
            if (Schema::hasColumn('strategies', 'assigned_cm_id')) {
                $table->dropForeign(['assigned_cm_id']);
                $table->dropColumn('assigned_cm_id');
            }
        });

        Schema::table('social_accounts', function (Blueprint $table) {
            foreach (['responsible_user_id', 'api_connected', 'follower_count'] as $col) {
                if (Schema::hasColumn('social_accounts', $col)) {
                    if ($col === 'responsible_user_id') {
                        $table->dropForeign(['responsible_user_id']);
                    }
                    $table->dropColumn($col);
                }
            }
        });
    }
};
