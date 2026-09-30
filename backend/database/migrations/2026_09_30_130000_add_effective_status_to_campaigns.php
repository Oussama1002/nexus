<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('campaigns') && ! Schema::hasColumn('campaigns', 'effective_status')) {
            Schema::table('campaigns', function (Blueprint $table) {
                $table->string('effective_status', 40)->nullable()->after('status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('campaigns') && Schema::hasColumn('campaigns', 'effective_status')) {
            Schema::table('campaigns', function (Blueprint $table) {
                $table->dropColumn('effective_status');
            });
        }
    }
};
