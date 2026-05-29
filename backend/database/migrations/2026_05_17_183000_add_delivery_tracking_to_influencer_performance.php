<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('influencer_performance')) {
            return;
        }

        Schema::table('influencer_performance', function (Blueprint $table) {
            if (! Schema::hasColumn('influencer_performance', 'action_type')) {
                $table->string('action_type', 50)->default('video')->after('metric_date');
            }
            if (! Schema::hasColumn('influencer_performance', 'planned_actions')) {
                $table->unsignedInteger('planned_actions')->default(1)->after('action_type');
            }
            if (! Schema::hasColumn('influencer_performance', 'completed_actions')) {
                $table->unsignedInteger('completed_actions')->default(0)->after('planned_actions');
            }
            if (! Schema::hasColumn('influencer_performance', 'manager_comment')) {
                $table->text('manager_comment')->nullable()->after('completed_actions');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('influencer_performance')) {
            return;
        }

        Schema::table('influencer_performance', function (Blueprint $table) {
            if (Schema::hasColumn('influencer_performance', 'manager_comment')) {
                $table->dropColumn('manager_comment');
            }
            if (Schema::hasColumn('influencer_performance', 'completed_actions')) {
                $table->dropColumn('completed_actions');
            }
            if (Schema::hasColumn('influencer_performance', 'planned_actions')) {
                $table->dropColumn('planned_actions');
            }
            if (Schema::hasColumn('influencer_performance', 'action_type')) {
                $table->dropColumn('action_type');
            }
        });
    }
};
