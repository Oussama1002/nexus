<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Group-chat messages have no single receiver — receiver_id must be
 * nullable when conversation_id is set. This migration ALTERs the
 * column without touching existing DM rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('internal_messages', 'receiver_id')) {
            return;
        }
        // Some MySQL builds refuse Doctrine's schema differ on foreign-key
        // columns; drop the FK first if present, ALTER, then re-add it.
        $fkName = null;
        $rows = DB::select(
            "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'internal_messages'
               AND COLUMN_NAME = 'receiver_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1"
        );
        if (!empty($rows)) {
            $fkName = $rows[0]->CONSTRAINT_NAME;
            DB::statement("ALTER TABLE `internal_messages` DROP FOREIGN KEY `{$fkName}`");
        }

        DB::statement("ALTER TABLE `internal_messages` MODIFY `receiver_id` BIGINT UNSIGNED NULL");

        if ($fkName) {
            DB::statement(
                "ALTER TABLE `internal_messages`
                 ADD CONSTRAINT `{$fkName}` FOREIGN KEY (`receiver_id`)
                 REFERENCES `users`(`id`) ON DELETE CASCADE"
            );
        }
    }

    public function down(): void
    {
        // Backfill any null receivers so the NOT NULL constraint can be
        // reinstated without failing. Uses sender_id as a placeholder —
        // safe because group messages will remain unreachable in DM mode.
        DB::statement("UPDATE `internal_messages` SET `receiver_id` = `sender_id` WHERE `receiver_id` IS NULL");
        DB::statement("ALTER TABLE `internal_messages` MODIFY `receiver_id` BIGINT UNSIGNED NOT NULL");
    }
};
