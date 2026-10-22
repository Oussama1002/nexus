<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['course_sections', 'course_lessons'] as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            Schema::table($table, function (Blueprint $t) use ($table) {
                if (! Schema::hasColumn($table, 'starts_at')) {
                    $t->timestamp('starts_at')->nullable()->after('sort_order');
                }
                if (! Schema::hasColumn($table, 'ends_at')) {
                    $t->timestamp('ends_at')->nullable()->after('starts_at');
                }
            });
        }
    }

    public function down(): void
    {
        foreach (['course_sections', 'course_lessons'] as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            Schema::table($table, function (Blueprint $t) use ($table) {
                foreach (['ends_at', 'starts_at'] as $col) {
                    if (Schema::hasColumn($table, $col)) {
                        $t->dropColumn($col);
                    }
                }
            });
        }
    }
};
