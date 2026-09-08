<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Attachment columns on internal_messages so DMs and group messages can
 * carry a single image or file. body is now nullable — an attachment
 * alone (no caption) is a valid message.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('internal_messages', function (Blueprint $table) {
            if (! Schema::hasColumn('internal_messages', 'attachment_url')) {
                $table->string('attachment_url', 500)->nullable()->after('body');
            }
            if (! Schema::hasColumn('internal_messages', 'attachment_name')) {
                $table->string('attachment_name', 255)->nullable()->after('attachment_url');
            }
            if (! Schema::hasColumn('internal_messages', 'attachment_mime')) {
                $table->string('attachment_mime', 120)->nullable()->after('attachment_name');
            }
            if (! Schema::hasColumn('internal_messages', 'attachment_size')) {
                $table->unsignedInteger('attachment_size')->nullable()->after('attachment_mime');
            }
        });
        // Allow body to be null (attachment-only message).
        \Illuminate\Support\Facades\DB::statement("ALTER TABLE `internal_messages` MODIFY `body` TEXT NULL");
    }

    public function down(): void
    {
        Schema::table('internal_messages', function (Blueprint $table) {
            foreach (['attachment_url', 'attachment_name', 'attachment_mime', 'attachment_size'] as $col) {
                if (Schema::hasColumn('internal_messages', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
        \Illuminate\Support\Facades\DB::statement("UPDATE `internal_messages` SET `body` = '' WHERE `body` IS NULL");
        \Illuminate\Support\Facades\DB::statement("ALTER TABLE `internal_messages` MODIFY `body` TEXT NOT NULL");
    }
};
