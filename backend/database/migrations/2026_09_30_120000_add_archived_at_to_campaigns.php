<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('campaigns') && ! Schema::hasColumn('campaigns', 'archived_at')) {
            Schema::table('campaigns', function (Blueprint $table) {
                $table->timestamp('archived_at')->nullable()->after('status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('campaigns') && Schema::hasColumn('campaigns', 'archived_at')) {
            Schema::table('campaigns', function (Blueprint $table) {
                $table->dropColumn('archived_at');
            });
        }
    }
};
