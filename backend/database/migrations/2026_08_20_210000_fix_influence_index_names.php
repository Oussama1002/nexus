<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('influencer_published_contents')) {
            return;
        }

        $this->ensureIndex(
            'influencer_published_contents',
            'ipc_collab_deliv_idx',
            ['collaboration_id', 'deliverable_id']
        );

        $this->ensureIndex(
            'influencer_published_contents',
            'ipc_influencer_brand_idx',
            ['influencer_id', 'brand_id']
        );
    }

    public function down(): void
    {
        // No-op: keep indexes.
    }

    private function ensureIndex(string $table, string $indexName, array $columns): void
    {
        $exists = DB::selectOne(
            'SELECT COUNT(1) AS c
             FROM information_schema.statistics
             WHERE table_schema = DATABASE()
               AND table_name = ?
               AND index_name = ?',
            [$table, $indexName]
        );

        if ((int) ($exists->c ?? 0) > 0) {
            return;
        }

        $cols = implode(', ', array_map(fn ($c) => '`' . $c . '`', $columns));
        DB::statement("ALTER TABLE `{$table}` ADD INDEX `{$indexName}` ({$cols})");
    }
};
