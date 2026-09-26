<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// CACHE_STORE=database : Laravel attend les tables cache/cache_locks avec les
// colonnes key/value/expiration. Une table « cache » héritée sans colonne
// « key » fait échouer tout ce qui passe par le cache (throttling, etc.).
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cache') && ! Schema::hasColumn('cache', 'key')) {
            Schema::rename('cache', 'cache_legacy_backup');
        }

        if (! Schema::hasTable('cache')) {
            Schema::create('cache', function (Blueprint $table) {
                $table->string('key')->primary();
                $table->mediumText('value');
                $table->integer('expiration');
            });
        }

        if (Schema::hasTable('cache_locks') && ! Schema::hasColumn('cache_locks', 'key')) {
            Schema::rename('cache_locks', 'cache_locks_legacy_backup');
        }

        if (! Schema::hasTable('cache_locks')) {
            Schema::create('cache_locks', function (Blueprint $table) {
                $table->string('key')->primary();
                $table->string('owner');
                $table->integer('expiration');
            });
        }
    }

    public function down(): void
    {
        // Non-destructif : les tables héritées restent sous *_legacy_backup.
    }
};
