<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Auto-capture columns: fingerprint for dedup, occurrence counter and
 * last-seen timestamp for aggregated errors, source flag ('user' | 'runtime').
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bugs_incidents', function (Blueprint $table) {
            if (! Schema::hasColumn('bugs_incidents', 'fingerprint')) {
                $table->string('fingerprint', 64)->nullable()->after('module');
                $table->index('fingerprint', 'bi_fingerprint_idx');
            }
            if (! Schema::hasColumn('bugs_incidents', 'source')) {
                $table->string('source', 20)->default('user')->after('fingerprint');
            }
            if (! Schema::hasColumn('bugs_incidents', 'occurrences')) {
                $table->unsignedInteger('occurrences')->default(1)->after('source');
            }
            if (! Schema::hasColumn('bugs_incidents', 'last_seen_at')) {
                $table->timestamp('last_seen_at')->nullable()->after('occurrences');
            }
            if (! Schema::hasColumn('bugs_incidents', 'trace')) {
                $table->text('trace')->nullable()->after('description');
            }
            if (! Schema::hasColumn('bugs_incidents', 'context')) {
                $table->json('context')->nullable()->after('trace');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bugs_incidents', function (Blueprint $table) {
            foreach (['fingerprint', 'source', 'occurrences', 'last_seen_at', 'trace', 'context'] as $col) {
                if (Schema::hasColumn('bugs_incidents', $col)) {
                    if ($col === 'fingerprint') {
                        $table->dropIndex('bi_fingerprint_idx');
                    }
                    $table->dropColumn($col);
                }
            }
        });
    }
};
