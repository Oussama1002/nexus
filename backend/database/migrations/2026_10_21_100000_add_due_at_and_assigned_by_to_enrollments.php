<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('enrollments')) {
            return;
        }

        Schema::table('enrollments', function (Blueprint $table) {
            if (! Schema::hasColumn('enrollments', 'due_at')) {
                $table->timestamp('due_at')->nullable()->after('expires_at');
            }
            if (! Schema::hasColumn('enrollments', 'assigned_by')) {
                $table->foreignId('assigned_by')->nullable()->after('sales_agent_id')->constrained('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('enrollments')) {
            return;
        }

        Schema::table('enrollments', function (Blueprint $table) {
            if (Schema::hasColumn('enrollments', 'assigned_by')) {
                $table->dropConstrainedForeignId('assigned_by');
            }
            if (Schema::hasColumn('enrollments', 'due_at')) {
                $table->dropColumn('due_at');
            }
        });
    }
};
